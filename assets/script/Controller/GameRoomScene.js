cc.Class({
    extends: cc.Component,
    // 708034
    properties: {
        soundPrefab: cc.Prefab,
        userInfoPrefab: cc.Prefab,
        cardMarkPrefab: cc.Prefab,

        cardPinList: cc.SpriteAtlas,

        // 当前出牌的人前面的标识
        makeSeat: {
            default: [],
            type: cc.Node,
        },

        // 听牌提示
        tingCardDistrict: cc.Node,

        /**
         * 解散房间
         */
        voteDismiss: cc.Node,
        voteSponsor: cc.Label,
        voteExpireSeconds: cc.Label,
        votePlayers: {
            default: [],
            type: cc.Node,
        },
        voteDismissButton: {
            default: [],
            type: cc.Node,
        },

        /**
         * 摸到的牌
         */
        getHandcard: {
            default: [],
            type: cc.Node,
        },

        /**
         * 0: 玩家1
         * 1: 玩家24
         * 3: 玩家3
         */
        handCardPrefabs: {
            default: [],
            type: cc.Prefab,
        },

        handCardDistrict: {
            default: [],
            type: cc.Node,
        },

        /**
         * 0: 玩家13
         * 1: 玩家24
         */
        dirtyCardPrefabs: {
            default: [],
            type: cc.Prefab,
        },

        dirtyCardDistrict: {
            default: [],
            type: cc.Node,
        },

        // 碰和吃
        pongAndChowPrefab: {
            default: [],
            type: cc.Prefab,
        },

        // 明杠
        exposedPrefab: {
            default: [],
            type: cc.Prefab,
        },

        // 暗杠
        concealedKongPrefab: {
            default: [],
            type: cc.Prefab,
        },

        pongKongChowDistrict: {
            default: [],
            type: cc.Node,
        },

        playerInfoList: {
            default: [],
            type: cc.Node,
        },

        inviteButtonList: {
            default: [],
            type: cc.Node,
        },

        chatList: {
            default: [],
            type: cc.Node,
        },

        roomInfo: {
            default: [],
            type: cc.Label,
        },

        /**
         * 动作相关
         */
        actionPanel: {
            default: [],
            type: cc.Node,
        },

        actionSprite: {
            default: [],
            type: cc.Node,
        },

        selectChi: {
            default: [],
            type: cc.Node,
        },

        waitPanel: cc.Node,

        fastChatPanel: cc.Node,

        menuPanel: cc.Node,

        hupaiPrompt: cc.Node,

        bonusPoint: cc.Label,

        fastChatProgressBar: cc.ProgressBar,

        voiceProgressBar: cc.ProgressBar,

        wechatInviteButton: cc.Button,

        sequence: 99999,
    },

    onLoad() {
        this._GameRoomCache = {};
        this._GameRoomCache.roomId = '';        // 房间号
        this._GameRoomCache.ownerUuid = '';     // 房主uuid
        this._GameRoomCache.playerList = [];    // 玩家信息列表
        this._GameRoomCache.promptList = [];    // 提示操作信息
        this._GameRoomCache.thisPlayerSeat = 0; // 当前玩家实际座位号
        this._GameRoomCache.thisDealerSeat = 0; // 当前庄家相对座位号
        this._GameRoomCache.activeCardFlag = null;  // 最后出的那张牌上面的标识
        this._GameRoomCache.activeCard = null;      // 当前最后出的那张牌
        this._GameRoomCache.waitDraw = false;       // 是否等待抓拍, 客户端逻辑
        this._GameRoomCache.allowOutCard = false;   // 是否允许出牌

        // todo: 需要删除
        this._initScene();

        if (Global.tempCache) {
            const self = this;
            this.wsUrl = `ws://${Global.tempCache.serverIp}:${Global.tempCache.serverPort}/ws`;
            this._GameRoomCache.roomId = Global.tempCache.roomId;

            this.webSocket = WebSocketManager.openSocketLink(this.wsUrl);
            this.webSocket.addEventListener('open', (evt) => {
                Global.log(['WebSocket.open: ', evt]);
                WebSocketManager.sendSocketMessage(self.webSocket, 'EnterRoom', { roomId: self._GameRoomCache.roomId });
                WebSocketManager.sendSocketMessage(self.webSocket, 'Ready');
            }, false);
            this.webSocket.addEventListener('message', (evt) => {
                const data = WebSocketManager.ArrayBuffer.reader(evt.data);
                Global.log(`WebSocket onmessage: ${JSON.stringify(data)}`);
                if (data === false) {
                    Global.log('WebSocket.message: WebSocket数据解析失败');
                    return;
                }

                const commandName = Tools.findKeyForValue(WebSocketManager.Command, data.cmd);
                if (commandName === false) {
                    Global.log('WebSocket.message: Tools.findKeyForValue数据解析失败');
                    return;
                }

                const result = Tools.protobufToJson(proto.game[`${commandName}Response`].deserializeBinary(data.data));
                if (!result) {
                    Global.log('WebSocket.message: Tools.protobufToJson数据解析失败');
                    return;
                }

                Global.log([`WebSocket.message ${commandName}: `, result]);
                self[`on${commandName}Message`](result);
            }, false);

            this.roomInfo[1].string = `房间号: ${this._GameRoomCache.roomId}`;
        }

        this.emojiNode = cc.Node;
        this.fastChatShowTime = +new Date();

        this.fastChatPanelPosition = this.fastChatPanel.position;
        this.menuPanelPosition = this.menuPanel.position;

        this.audio = Tools.audioEngine.init();

        this._userInfo = Tools.getLocalData(Global.LSK.userInfo);
        this.playerInfoList[0].getChildByName('text_nick').getComponent(cc.Label).string = this._userInfo.nickname;
        Tools.setWebImage(this.playerInfoList[0].getChildByName('img_handNode').getComponent(cc.Sprite), this._userInfo.headimgurl);
    },

    update(dt) {
        this.roomInfo[0].string = Tools.formatDatetime('hh:ii:ss');

        // 每次聊天的冷却时间
        if (+new Date() > Global.fastChatShowTime + this.fastChatShowTime) {
            if (this.emojiNode.isValid) {
                this.emojiNode.destroy();
            }
        }

        if (this.fastChatProgressBar.progress <= 1.0 && this.fastChatProgressBar.progress >= 0) {
            this.fastChatProgressBar.progress -= dt * Global.fastChatWaitTime;
        }

        if (this.voiceProgressBar.progress <= 1.0 && this.voiceProgressBar.progress >= 0) {
            this.voiceProgressBar.progress -= dt * Global.fastChatWaitTime;
        }
    },

    /**
     *******************************************************************************************************************
     *                                       public socket on message
     *******************************************************************************************************************
     **/

    onEnterRoomMessage(data) {
        if (data.code !== 1) {
            return;
        }

        data.kwargs = JSON.parse(data.kwargs);
        this._GameRoomCache.ownerUuid = data.ownerUuid;
        this._roomInfo(data.kwargs, 0, data.restCards);

        this._setThisPlayerSeat(data.playerList);

        for (let i = 0; i < data.playerList.length; i += 1) {
            const obj = data.playerList[i];
            const playerIndex = this._computeSeat(obj.seat);
            obj.info = JSON.parse(obj.info);

            this.inviteButtonList[playerIndex].active = false;
            this.playerInfoList[playerIndex].active = true;
            this.playerInfoList[playerIndex].getChildByName('text_nick').getComponent(cc.Label).string = obj.info.nickname;
            this.playerInfoList[playerIndex].getChildByName('text_result').getComponent(cc.Label).string = obj.totalScore || 0;
            Tools.setWebImage(this.playerInfoList[playerIndex].getChildByName('img_handNode').getComponent(cc.Sprite), obj.info.headimgurl);

            // 设置房主
            if (obj.playerUuid === data.ownerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_hostmark').active = true;
            }

            // 是否在线
            if (this._userInfo.playerUuid !== obj.playerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_offline').active = obj.isOnline === 0;
            }

            if (playerIndex !== 0) {
                this.inviteButtonList[playerIndex].active = false;
                this.playerInfoList[playerIndex].active = true;
            }
        }

        if (data.playerList.length !== 4) {
            this.inviteButtonList[0].active = true;
        }

        this._GameRoomCache.playerList = data.playerList;
    },

    onEnterRoomOtherMessage(data) {
        if (data.code !== 1) {
            return;
        }

        data.info = JSON.parse(data.info);
        this._GameRoomCache.playerList.push(data);

        const playerIndex = this._computeSeat(data.seat);

        this.inviteButtonList[playerIndex].active = false;
        this.playerInfoList[playerIndex].active = true;

        this.playerInfoList[playerIndex].getChildByName('text_nick').getComponent(cc.Label).string = data.info.nickname;
        this.playerInfoList[playerIndex].getChildByName('text_result').getComponent(cc.Label).string = data.totalScore || 0;
        Tools.setWebImage(this.playerInfoList[playerIndex].getChildByName('img_handNode').getComponent(cc.Sprite), data.info.headimgurl);

        // 设置房主
        if (data.playerUuid === this._GameRoomCache.ownerUuid) {
            this.playerInfoList[playerIndex].getChildByName('img_hostmark').active = true;
        }

        // 如果房间人数满了, 关闭邀请按钮
        if (this._GameRoomCache.playerList.length === 4) {
            this.inviteButtonList[0].active = false;
        }
    },

    onExitRoomMessage(data) {
        if (data.code !== 1) {
            return;
        }

        const playerIndex = this._computeSeat(this._getSeatForPlayerUuid(data.playerUuid));
        this._showInvietButton(playerIndex);
        this._hidePlayerInfoList(playerIndex);

        // 从玩家列表中删除该用户
        for (let i = 0; i < this._GameRoomCache.playerList.length; i += 1) {
            if (this._GameRoomCache.playerList[i].playerUuid === data.playerUuid) {
                cc.js.array.removeAt(this._GameRoomCache.playerList, i);
                break;
            }
        }
    },

    onDismissRoomMessage(data) {
        if (data.code === 5003) {
            Global.tempCache = '您不是房主, 无法解散房间';
            Global.dialog.open('Dialog', this.node);
            return;
        }

        if (data.code !== 1) {
            return;
        }

        if (data.flag === 0) {
            if (this._GameRoomCache.ownerUuid === this._userInfo.playerUuid) {
                this.webSocket.close();
                cc.director.loadScene('Lobby');
            }
            else {
                Global.tempCache = '房主已解散房间';
                Global.dialog.open('Dialog', this.node, () => {
                    this.webSocket.close();
                    cc.director.loadScene('Lobby');
                });
            }
        }
        else if (data.flag === 1) {
            this.webSocket.close();
            cc.director.loadScene('Lobby');
        }
    },

    onSponsorVoteMessage(data) {
        this._initVotePanel(data);
    },

    onPlayerVoteMessage(data) {
        for (let i = 0; i < this._votePlayers.length; i += 1) {
            const obj = this._votePlayers[i];
            if (obj.playerUuid === data.playerUuid) {
                this.votePlayers[i].getChildByName('userSelectTxt').getComponent(cc.Label).string = data.flag ? '同意' : '拒绝';
            }
        }
    },

    onOnlineStatusMessage(data) {
        const playerIndex = this._computeSeat(this._getSeatForPlayerUuid(data.playerUuid));
        this.playerInfoList[playerIndex].getChildByName('img_offline').active = !data.status;
    },

    // todo: 需要优化, 每个表情都需要定位到玩家前面, 或者干脆就不要表情了
    onSpeakerMessage(data) {
        data.content = JSON.parse(data.content);

        for (let i = 0; i < this._GameRoomCache.playerList.length; i += 1) {
            if (this._GameRoomCache.playerList[i].playerUuid === data.playerUuid) {
                const playerIndex = this._computeSeat(this._GameRoomCache.playerList[i].seat);
                const self = this;

                // 评论
                if (data.content.type === 1) {
                    this.audio.setAudioRaw(Global.audioUrl.fastChat[`fw_${this._GameRoomCache.playerList[i].sex === 1 ? 'male' : 'female'}_${data.content.data}`]).play();

                    this.chatList[playerIndex].getChildByName('txtMsg').getComponent(cc.Label).string = Tools.findNode(this.fastChatPanel, `fastChatView1>fastViewItem${data.content.data}>Label`).getComponent(cc.Label).string;

                    self.chatList[playerIndex].active = true;
                    this.scheduleOnce(() => {
                        self.chatList[playerIndex].active = false;
                    }, 3);
                }
                // 表情
                else if (data.content.type === 2) {
                    Tools.loadRes(`emoji/emotion${data.content.data}`, cc.Prefab, (prefab) => {
                        const node = cc.instantiate(prefab);
                        self.emojiNode = node;
                        self.node.addChild(node);
                        node.getComponent(cc.Animation).play(`emotion${data.content.data}`);
                    });
                }
                // 语音
                else if (data.content.type === 3) {
                    Tools.setWebAudio(data.content.data, (audioRaw) => {
                        self.audio.setAudioRaw(audioRaw).play();
                    });
                }

                break;
            }
        }
    },

    onReadyMessage(data) {
        const playerIndex = this._computeSeat(this._getSeatForPlayerUuid(data.playerUuid));
        this.playerInfoList[playerIndex].getChildByName('img_offline').active = false;
    },

    onDealMessage(data) {
        this._GameRoomCache.gameing = false;
        this._GameRoomCache.waitDraw = true;

        // 移动三号位的玩家头像到右边, 避免被挡住
        this.playerInfoList[2].setPositionX(-134);

        // 庄家
        this._GameRoomCache.thisDealerSeat = this._computeSeat(this._getSeatForPlayerUuid(data.dealerUuid));
        this.playerInfoList[this._GameRoomCache.thisDealerSeat].getChildByName('img_zhuang').active = true;

        // 初始化手牌
        this._appendCardToHandCardDistrict(0, data.cardsInHandList);
        this._appendCardToHandCardDistrict(1, new Array(13));
        this._appendCardToHandCardDistrict(2, new Array(13));
        this._appendCardToHandCardDistrict(3, new Array(13));

        this._GameRoomCache.gameing = true;
    },

    onDrawMessage(data) {
        Global.playEffect(Global.audioUrl.effect.dealCard);

        this._GameRoomCache.allowOutCard = true;

        const self = this;
        this.scheduleOnce(() => {
            const playerIndex = self._computeSeat(self._getSeatForPlayerUuid(data.playerUuid));

            // 如果抓拍的人是自己才对数据进行处理
            if (playerIndex === 0) {
                const clickEventHandler = Tools.createEventHandler(self.node, 'GameRoomScene', 'selectedHandCardOnClick', data.card.card);
                this.getHandcard[playerIndex].getChildByName('Background').getComponent(cc.Button).clickEvents[0] = clickEventHandler;
                const nodeSprite = Tools.findNode(self.getHandcard[playerIndex], 'Background>value').getComponent(cc.Sprite);
                nodeSprite.spriteFrame = self.cardPinList.getSpriteFrame(`value_0x${data.card.card.toString(16)}`);
            }

            self.getHandcard[playerIndex].active = true;

            this._openLight(playerIndex);
        }, this._GameRoomCache.waitDraw ? 3 : 0);

        this._GameRoomCache.waitDraw = false;   // 不是起手抓拍, 不需要再等待
    },

    onDiscardMessage(data) {
        const playerIndex = this._computeSeat(this._getSeatForPlayerUuid(data.playerUuid));
        const node = cc.instantiate(this.dirtyCardPrefabs[playerIndex]);
        const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
        nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data.card.card.toString(16)}`);

        this.dirtyCardDistrict[playerIndex].addChild(node);
        this._GameRoomCache.activeCard = node;

        this._createActiveCardFlag(playerIndex);
    },

    onSynchroniseCardsMessage(data) {
        if (data.code !== 1) {
            return;
        }

        this.handCardDistrict[0].removeAll();

        for (let i = 0; i < data.card.length; i += 1) {
            const obj = data.card[i];
            const node = cc.instantiate(this.handCardPrefabs[0]);
            const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
            nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${obj.card.toString(16)}`);

            this.handCardDistrict[0].addChild(node);
        }
    },

    /**
     *******************************************************************************************************************
     *                                       px258 socket on message
     *******************************************************************************************************************
     **/

    onReconnectMessage(data) {
        data.kwargs = JSON.parse(data.kwargs);
        this._GameRoomCache.roomId = data.roomId;
        this._GameRoomCache.ownerUuid = data.ownerUuid;
        this._GameRoomCache.gameing = true;
        this._GameRoomCache.waitDraw = false;

        this._initScene();

        if (data.playerList.length === 4) {
            this._hideInvietButton();
            this.playerInfoList[2].setPositionX(-134);  // 移动三号位的玩家头像到右边, 避免被挡住
        }

        // 初始化房间信息
        this._roomInfo(data.kwargs, data.currentRound, data.restCards);

        // 设置当前玩家的座位号
        this._setThisPlayerSeat(data.playerList);

        // 初始化玩家信息
        for (let i = 0; i < data.playerList.length; i += 1) {
            const obj = data.playerList[i];
            obj.info = JSON.parse(obj.info);
            const playerIndex = this._computeSeat(obj.seat);
            this._setPlayerInfoList(playerIndex, obj.info, obj.totalScore);

            // 设置房主
            if (obj.playerUuid === data.ownerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_hostmark').active = true;
            }

            // 是否在线
            if (this._userInfo.playerUuid !== obj.playerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_offline').active = obj.isOnline === 0;
            }

            // 初始化手牌
            this._appendCardToHandCardDistrict(playerIndex, obj.cardsInHandList);
            this._appendCardToDiscardDistrict(playerIndex, obj.cardsDiscardList);
            this._appendConcealedKongToDistrict(playerIndex, obj.cardsKongConcealedList);
            this._appendExposedToDistrict(playerIndex, obj.cardsKongExposedList);
            this._appendPongToDistrict(playerIndex, obj.cardsPongList);
            this._appendChowToDistrict(playerIndex, obj.cardsChowList);
        }

        // 庄家
        this._GameRoomCache.thisDealerSeat = this._computeSeat(data.dealer);
        this.playerInfoList[this._GameRoomCache.thisDealerSeat].getChildByName('img_zhuang').active = true;

        this._GameRoomCache.playerList = data.playerList;

        // 当前活动玩家座位号, 打出去的牌上面的小标识
        if (data.discardSeat !== -1) {
            this._createActiveCardFlag(this._computeSeat(data.discardSeat));
        }

        // 当前出牌玩家
        if (data.activeSeat !== -1) {
            this._openLight(this._computeSeat(data.activeSeat));
        }

        window.testData = this.handCardDistrict[0];
    },

    onPromptMessage(data) {
        this._GameRoomCache.promptList = data.promptList;

        if (data.promptList.length > 0) {
            this.actionPanel[0].active = true;
        }

        let promptType = [];

        for (let i = 0; i < data.promptList.length; i += 1) {
            promptType.push(data.promptList[i].prompt);
        }

        promptType = Tools.unique(promptType);

        for (let i = 0; i < promptType.length; i += 1) {
            let actionPanelIndex = 0;
            if (promptType[i] === Global.promptType.Chow) {
                actionPanelIndex = 1;
            }
            else if (promptType[i] === Global.promptType.Pong) {
                actionPanelIndex = 2;
            }
            else if (promptType[i] === Global.promptType.KongConcealed || promptType[i] === Global.promptType.kongExposed) {
                actionPanelIndex = 3;
            }
            else if (promptType[i] === Global.promptType.WinDiscard || promptType[i] === Global.promptType.WinDraw) {
                actionPanelIndex = 4;
            }

            const promptList = this._getActionIdFromPromptList([promptType[i]]);
            const clickEventHandler = Tools.createEventHandler(this.node, 'GameRoomScene', 'actionOnClick', JSON.stringify(promptList));
            this.actionPanel[actionPanelIndex].getComponent(cc.Button).clickEvents[0] = clickEventHandler;
            this.actionPanel[actionPanelIndex].active = true;
        }
    },

    onActionMessage(data) {
        if (data.activeCard) {
            this._GameRoomCache.activeCard.destroy();
        }

        const playerIndex = this._computeSeat(data.triggerSeat);

        // todo: 音频, 根据不同的用户的位置动画提示
        if (data.activeType === Global.promptType.Chow) {
            this._appendChowToDistrict(playerIndex, data.refCard);
        }
        else if (data.activeType === Global.promptType.Pong) {
            this._appendPongToDistrict(playerIndex, data.refCard);
        }
        else if (data.activeType === Global.promptType.KongConcealed) {
            this._appendConcealedKongToDistrict(playerIndex, data.refCard);
        }
        else if (data.activeType === Global.promptType.kongExposed) {
            this._appendExposedToDistrict(playerIndex, data.refCard);
        }
        else if (data.activeType === Global.promptType.WinDiscard || data.activeType === Global.promptType.WinDraw) {
            // todo: 胡牌
        }
    },

    onReadyHandMessage(data) {
        for (let j = 0; j < this.tingCardDistrict.children.length; j += 1) {
            if (j !== 0) {
                this.tingCardDistrict.children[j].destroy();
            }
        }

        for (let i = 0; i < data.cardList.length; i += 1) {
            const node = cc.instantiate(this.dirtyCardPrefabs[0]);
            const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
            nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data.cardList[i].card.toString(16)}`);
            this.tingCardDistrict.addChild(node);
        }

        this.tingCardDistrict.active = true;
    },

    onSettleForRoundMessage(data) {
        Global.tempCache = { data, playerInfoList: this._GameRoomCache.playerList };
        cc.director.loadScene('SmallAccount');
    },

    onSettleForRoomMessage(data) {
        Global.tempCache = { data, playerInfoList: this._GameRoomCache.playerList };
        cc.director.loadScene('SmallAccount');
    },

    /**
     *******************************************************************************************************************
     *                                       button on click
     *******************************************************************************************************************
     **/

    showUserInfoOnClick(evt, data) {
        Global.log(this._GameRoomCache);
        for (let i = 0; i < this._GameRoomCache.playerList.length; i += 1) {
            const playerIndex = this._computeSeat(this._GameRoomCache.playerList[i].seat);
            if (playerIndex == data) {
                Global.tempCache = this._GameRoomCache.playerList[i].info;
                Global.openDialog(cc.instantiate(this.userInfoPrefab), this.node);
                break;
            }
        }
    },

    /**
     * 微信邀请
     */
    wechatInviteOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Tools.captureScreen(this.node, (filePath) => {
            Global.log(filePath);
        });
    },

    openFastChatPanelOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Global.log([this.fastChatProgressBar.progress, this.fastChatPanel.position.x, this.fastChatPanelPosition.x]);
        if (this.fastChatProgressBar.progress <= 0) {
            if (this.fastChatPanel.position.x === this.fastChatPanelPosition.x) {
                Animation.openPanel(this.fastChatPanel);
            }
            else {
                const self = this;
                Animation.closePanel(this.fastChatPanel, () => {
                    self.fastChatPanel.setPositionX(self.fastChatPanelPosition.x);
                });
            }
        }
    },

    /**
     * 发送语音
     */
    voiceOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        if (this.voiceProgressBar.progress <= 0) {
            this.voiceProgressBar.progress = 1.0;
            Global.log('voiceOnClick');
        }
    },

    openMenuOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Global.log([parseInt(this.menuPanel.position.x.toFixed(0), 10), this.menuPanelPosition.x]);
        if (this.menuPanel.position.x === this.menuPanelPosition.x) {
            Animation.openPanel(this.menuPanel);
        }
        else {
            const self = this;
            Animation.closePanel(this.menuPanel, () => {
                self.menuPanel.setPositionX(self.menuPanelPosition.x);
            });
        }
    },

    closeDialogOnClick() {
        // 检查是否关闭聊天面板
        if (this.fastChatPanel.position.x !== this.fastChatPanelPosition.x) {
            Animation.closePanel(this.fastChatPanel);
        }

        // 检查是否关闭菜单面板
        if (this.menuPanel.position.x !== this.menuPanelPosition.x) {
            Animation.closePanel(this.menuPanel);
        }

        // 手牌复位
        if (this.handCardDistrict[0].childrenCount > 0) {
            this._resetHandCardPosition();
        }

        // 关闭听提示
        if (this.tingCardDistrict.active) {
            this.tingCardDistrict.active = false;
        }
    },

    switchFastChatPanelOnClick(evt, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        if (data === 1) {
            this.fastChatPanel.getChildByName('fastChatView1').active = true;
            this.fastChatPanel.getChildByName('fastChatView2').active = false;
        }
        else {
            this.fastChatPanel.getChildByName('fastChatView1').active = false;
            this.fastChatPanel.getChildByName('fastChatView2').active = true;
        }
    },

    wordChatOnClick(evt, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        const content = JSON.stringify({ type: 1, data });
        WebSocketManager.sendSocketMessage(this.webSocket, 'Speaker', { content });

        this.fastChatProgressBar.progress = 1.0;
        Global.playEffect(Global.audioUrl.fastChat[`fw_male_${data}`]);

        Animation.closePanel(this.fastChatPanel);
    },

    emojiChatOnClick(evt, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        const content = JSON.stringify({ type: 2, data });
        WebSocketManager.sendSocketMessage(this.webSocket, 'Speaker', { content });

        this.fastChatProgressBar.progress = 1.0;
        this.fastChatShowTime = +new Date();
        const self = this;

        Tools.loadRes(`emoji/emotion${data}`, cc.Prefab, (prefab) => {
            const node = cc.instantiate(prefab);
            self.emojiNode = node;
            self.node.addChild(node);
            node.getComponent(cc.Animation).play(`emotion${data}`);
        });

        Animation.closePanel(this.fastChatPanel);
    },

    actionOnClick(event, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        this._hideActionPanel();

        let actionId = null;
        const actionIdList = JSON.parse(data);

        if (actionIdList.length === 1) {
            actionId = actionIdList[0].actionId;
        }
        // TODO: 大于1表示需要弹出吃的选择
        else if (actionIdList.length > 1) {
            for (let i = 0; i < actionIdList.length; i += 1) {
                const obj = actionIdList[i];

                const clickEventHandler = Tools.createEventHandler(this.node, 'GameRoomScene', 'selectChiOnClick', JSON.stringify(obj));
                this.selectChi[i + 1].getComponent(cc.Button).clickEvents[0] = clickEventHandler;

                const children = this.selectChi[i + 1].children;
                for (let j = 0; j < children.length; j += 1) {
                    const nodeSprite = children[j].getChildByName('value').getComponent(cc.Sprite);
                    if (j === 0) {
                        nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${obj.opCard.card.toString(16)}`);
                    }
                    else {
                        nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${obj.refCardList[j + 1].card.toString(16)}`);
                    }
                }

                this.selectChi[i + 1].active = true;
            }
            this.selectChi[0].active = true;
            return;
        }

        WebSocketManager.sendSocketMessage(this.webSocket, 'Action', { actionId });
    },

    /**
     * 出牌
     *
     * @param event
     * @param data
     */
    selectedHandCardOnClick(event, data) {
        // 关闭听提示
        if (this.tingCardDistrict.active) {
            this.tingCardDistrict.active = false;
        }

        if (event.target.getPositionY() !== 0) {
            if (!this._GameRoomCache.allowOutCard) {
                return;
            }

            this._GameRoomCache.allowOutCard = false;
            event.target.parent.destroy();

            if (this.getHandcard[0].active) {
                this.getHandcard[0].active = false;
                const card = Tools.findNode(this.getHandcard[0], 'Background>value').getComponent(cc.Sprite).spriteFrame._name.replace(/value_0x/, '');
                this._appendCardToHandCardDistrict(0, [{ card }]);
            }

            WebSocketManager.sendSocketMessage(this.webSocket, 'Discard', { card: data });

            Global.playEffect(Global.audioUrl.effect.cardOut);
        }
        else {
            this._resetHandCardPosition();
            event.target.setPositionY(24);
        }
    },

    /**
     * 声音选项
     */
    openSoundPanelOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Global.openDialog(cc.instantiate(this.soundPrefab), this.node, () => {
            Global.log('load success');
        });
    },

    /**
     * 解散房间
     */
    dismissOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        WebSocketManager.sendSocketMessage(this.webSocket, 'DismissRoom');
    },

    voteOnClick(evt, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        WebSocketManager.sendSocketMessage(this.webSocket, 'PlayerVote', { flog: data == 1 });

        this.voteDismissButton[0].active = false;
        this.voteDismissButton[1].active = false;

        this.unschedule(this._expireSeconds);
    },

    /**
     * 选择需要吃的牌
     */
    selectChiOnClick(evt, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        this._hideSelectChiPanel();

        data = JSON.parse(data);
        WebSocketManager.sendSocketMessage(this.webSocket, 'Action', { actionId: data.actionId });
    },

    closeOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        if (this._GameRoomCache.playerList.length !== 4) {
            WebSocketManager.sendSocketMessage(this.webSocket, 'ExitRoom', { roomId: this._GameRoomCache.roomId });
            this.webSocket.close();
            cc.director.loadScene('Lobby');
        }
        else {
            Global.tempCache = '游戏中无法退出';
            Global.dialog.open('Dialog', this.node);
        }
    },

    /**
     *******************************************************************************************************************
     *                                       callback
     *******************************************************************************************************************
     **/

    onReadyGame() {
        WebSocketManager.sendSocketMessage(this.webSocket, 'Ready');
    },

    /**
     *******************************************************************************************************************
     *                                       function
     *******************************************************************************************************************
     **/

    /**
     * 0: 过
     * 1: 吃
     * 2: 碰
     * 3: 杠
     * 4: 胡
     * 5: 中间显示当前选择的动作, 0 除外
     */
    _hideActionPanel() {
        for (let i = 0; i < this.actionPanel.length; i += 1) {
            this.actionPanel[i].active = false;
        }
    },

    /**
     * 隐藏词牌提示
     * @private
     */
    _hideSelectChiPanel() {
        for (let i = 0; i < this.selectChi.length; i += 1) {
            this.selectChi[i].active = false;
        }
    },

    _showActionPanel(indexs) {
        if (indexs.length === 1) {
            const self = this;
            self._hideActionPanel();
            this.scheduleOnce(() => {
                self._hideActionPanel();
            }, 1);
        }

        for (let i = 0; i < indexs.length; i += 1) {
            this.actionPanel[indexs[i]].active = true;
        }
    },

    /**
     * 添加牌到手牌区
     *
     * @param player
     * @param data
     * @private
     */
    _appendCardToHandCardDistrict(player, data) {
        const self = this;
        function insert(card) {
            const node = cc.instantiate(self.handCardPrefabs[player]);
            self.handCardDistrict[player].addChild(node);

            if (player === 0) {
                const clickEventHandler = Tools.createEventHandler(self.node, 'GameRoomScene', 'selectedHandCardOnClick', card);
                node.getChildByName('Background').getComponent(cc.Button).clickEvents.push(clickEventHandler);
                const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
                nodeSprite.spriteFrame = self.cardPinList.getSpriteFrame(`value_0x${card.toString(16)}`);
            }
        }

        if (this._GameRoomCache.gameing) {
            for (let i = data.length - 1; i >= 0; i -= 1) {
                if (!data[i]) {
                    data[i] = { card: 0 };
                }
                insert(data[i].card);
            }
            if (player === 0) {
                Global.cardsSort(this.handCardDistrict[0].children);
            }
        }
        else if (data.length > 0) {
            let i = data.length - 1;
            this.schedule(() => {
                Global.playEffect(Global.audioUrl.effect.dealCard);
                if (!data[i]) {
                    data[i] = { card: 0 };
                }
                insert(data[i].card);
                i -= 1;
                if (i === -1 && player === 0) {
                    Global.cardsSort(this.handCardDistrict[0].children);
                }
            }, 0.2, (data.length - 1));
        }
    },

    /**
     * 暗杠
     *
     * @param player
     * @param data
     * @private
     */
    _appendConcealedKongToDistrict(player, data) {
        for (let i = 0; i < data.length; i += 1) {
            if (i % 4 === 0) {
                const node = cc.instantiate(this.concealedKongPrefab[player]);
                this.pongKongChowDistrict[player].addChild(node);

                const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
                nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data[i].card.toString(16)}`);
            }
        }
    },

    /**
     * 明杠
     *
     * @param player
     * @param data
     * @private
     */
    _appendExposedToDistrict(player, data) {
        let node = cc.Node;
        for (let j = 0; j < data.length; j += 1) {
            if (j % 4 === 0) {
                node = cc.instantiate(this.exposedPrefab[player]);
                this.pongKongChowDistrict[player].addChild(node);
            }

            const nodeSprite = node.children[j % 4].getChildByName('value').getComponent(cc.Sprite);
            nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data[j].card.toString(16)}`);
        }
    },

    /**
     * 碰
     *
     * @param player
     * @param data
     * @private
     */
    _appendPongToDistrict(player, data) {
        let node = cc.Node;
        for (let j = 0; j < data.length; j += 1) {
            if (j % 3 === 0) {
                node = cc.instantiate(this.pongAndChowPrefab[player]);
                this.pongKongChowDistrict[player].addChild(node);
            }

            const nodeSprite = node.children[j % 3].getChildByName('value').getComponent(cc.Sprite);
            nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data[j].card.toString(16)}`);
        }
    },

    /**
     * 吃
     *
     * @param player
     * @param data
     * @private
     */
    _appendChowToDistrict(player, data) {
        let node = cc.Node;
        for (let j = 0; j < data.length; j += 1) {
            if (j % 3 === 0) {
                node = cc.instantiate(this.pongAndChowPrefab[player]);
                this.pongKongChowDistrict[player].addChild(node);
            }

            const nodeSprite = node.children[j % 3].getChildByName('value').getComponent(cc.Sprite);
            nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data[j].card.toString(16)}`);
        }
    },

    /**
     * 添加牌到打出去的区域
     *
     * @param player
     * @param data
     * @private
     */
    _appendCardToDiscardDistrict(player, data) {
        for (let i = 0; i < data.length; i += 1) {
            const node = cc.instantiate(this.dirtyCardPrefabs[player]);
            const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
            nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${data[i].card.toString(16)}`);
            this.dirtyCardDistrict[player].addChild(node);
        }
    },

    _resetHandCardPosition() {
        for (let i = 0; i < this.handCardDistrict[0].childrenCount; i += 1) {
            this.handCardDistrict[0].children[i].getChildByName('Background').setPositionY(0);
        }
        this.getHandcard[0].getChildByName('Background').setPositionY(0);
    },

    _computeSeat(playerSeat) {
        const desplaySeat = playerSeat - this._GameRoomCache.thisPlayerSeat;
        return (desplaySeat < 0 ? desplaySeat + 4 : desplaySeat);
    },

    _initVotePanel(data) {
        this._votePlayers = [];
        for (let i = 0; i < this._GameRoomCache.playerList.length; i += 1) {
            const obj = this._GameRoomCache.playerList[i];
            if (obj.playerUuid === data.sponsor) {
                this.voteSponsor.string = obj.info.nickname;
            }
            else {
                this._votePlayers.push(obj);
            }
        }

        for (let i = 0; i < this._votePlayers.length; i += 1) {
            const obj = this._votePlayers[i];
            this.votePlayers[i].getChildByName('userTxt').getComponent(cc.Label).string = obj.info.nickname;
        }

        this.voteDismiss.active = true;

        // 如果是自己发起的投票, 就不需要再确认
        if (this._userInfo.playerUuid === data.sponsor) {
            data.expireSeconds = 1;

            this.voteDismissButton[0].active = false;
            this.voteDismissButton[1].active = false;

            this.voteExpireSeconds.string = '等待倒计时：0秒';
        }
        else {
            this.voteExpireSeconds.string = `等待倒计时：${data.expireSeconds}秒`;
        }

        const self = this;
        this._expireSeconds = () => {
            if (data.expireSeconds > 0) {
                data.expireSeconds -= 1;
                self.voteExpireSeconds.string = `等待倒计时：${data.expireSeconds}秒`;
            }
            else if (data.expireSeconds === 0) {
                self.unschedule(this._expireSeconds);
            }
        };
        this.schedule(this._expireSeconds, 1);
    },


    /**
     * 设置房间信息
     *
     * @param {Object} info
     * @param currentRound
     * @param restCards
     * @private
     */
    _roomInfo(info, currentRound, restCards) {
        // 游戏玩法
        const _gameInfo = Global.playerTypes[info.game_uuid];
        let gameInfo = '玩法: ';
        for (const k in info.play_type) {
            if (info.play_type[k] === 1) {
                gameInfo += `${_gameInfo.play_type[k]},`;
            }
        }
        gameInfo = `${gameInfo.substr(0, gameInfo.length - 1)}\n可选: `;

        for (const k in info.options) {
            if (info.options[k] === 1) {
                gameInfo += `${_gameInfo.options[k]},`;
            }
        }
        gameInfo = gameInfo.substr(0, gameInfo.length - 1);

        this.roomInfo[1].string = `房间号: ${this._GameRoomCache.roomId}`;
        this.roomInfo[2].string = `局数: ${currentRound}/${info.max_rounds}`;
        this.roomInfo[3].string = `剩余牌数: ${restCards}`;
        this.roomInfo[4].string = gameInfo;
    },

    _getActionIdFromPromptList(prompt) {
        const promptList = [];
        for (let i = 0; i < this._GameRoomCache.promptList.length; i += 1) {
            const obj = this._GameRoomCache.promptList[i];
            if (prompt.indexOf(obj.prompt) !== -1) {
                promptList.push(obj);
            }
        }
        return promptList;
    },

    /**
     * 生成标识
     */
    _createActiveCardFlag(index) {
        this._deleteActiveCardFlag();
        if (this.dirtyCardDistrict[index].childrenCount > 0) {
            this._GameRoomCache.activeCardFlag = cc.instantiate(this.cardMarkPrefab);
            const node = this.dirtyCardDistrict[index].children[this.dirtyCardDistrict[index].childrenCount - 1];
            node.addChild(this._GameRoomCache.activeCardFlag);
        }
    },

    _deleteActiveCardFlag() {
        if (this._GameRoomCache.activeCardFlag) {
            this._GameRoomCache.activeCardFlag.destroy();
        }
    },

    /**
     * 当玩家出牌时前面的灯是亮的
     */
    _openLight(index) {
        this._closeAllLight();
        this.makeSeat[index].getComponent(cc.Animation).play();
    },

    _closeAllLight() {
        for (let i = 0; i < 4; i += 1) {
            this.makeSeat[i].getComponent(cc.Animation).stop();
            this.makeSeat[i].opacity = 255;
        }
    },

    /**
     * 邀请按钮
     */
    _hideInvietButton(indexs) {
        indexs = indexs || [0, 1, 2, 3];
        for (let i = 0; i < indexs.length; i += 1) {
            this.inviteButtonList[indexs[i]].active = false;
        }
    },

    _showInvietButton(indexs) {
        indexs = indexs || [0, 1, 2, 3];
        for (let i = 0; i < indexs.length; i += 1) {
            this.inviteButtonList[indexs[i]].active = true;
        }
    },

    /**
     * 玩家信息
     */
    _hidePlayerInfoList(indexs) {
        indexs = indexs || [0, 1, 2, 3];
        for (let i = 0; i < indexs.length; i += 1) {
            this.playerInfoList[indexs[i]].active = false;
        }
    },

    _showPlayerInfoList(indexs) {
        indexs = indexs || [0, 1, 2, 3];
        for (let i = 0; i < indexs.length; i += 1) {
            this.playerInfoList[indexs[i]].active = true;
        }
    },

    _setPlayerInfoList(index, data, totalScore) {
        this._hideInvietButton([index]);
        this._showPlayerInfoList([index]);

        this.playerInfoList[index].getChildByName('text_nick').getComponent(cc.Label).string = data.nickname;
        this.playerInfoList[index].getChildByName('text_result').getComponent(cc.Label).string = totalScore || 0;
        Tools.setWebImage(this.playerInfoList[index].getChildByName('img_handNode').getComponent(cc.Sprite), data.headimgurl);
    },

    /**
     * 初始化场景
     */
    _initScene() {
        for (let i = 0; i < 4; i += 1) {
            this.handCardDistrict[i].removeAllChildren();
            this.dirtyCardDistrict[i].removeAllChildren();
            this.pongKongChowDistrict[i].removeAllChildren();

            this._showInvietButton([0, 1, 2, 3]);
            this._hidePlayerInfoList([0, 1, 2, 3]);
            this._closeAllLight();

            this.playerInfoList[i].getChildByName('img_zhuang').active = false;
            this.playerInfoList[i].getChildByName('img_hostmark').active = false;
        }

        this.playerInfoList[2].setPositionX(-554);  // 移动三号位的玩家头像到中间
    },

    /**
     * 查找当前玩家的座位号
     */
    _setThisPlayerSeat(playerList) {
        for (let i = 0; i < playerList.length; i += 1) {
            const obj = playerList[i];
            if (obj.playerUuid === this._userInfo.playerUuid) {
                this._GameRoomCache.thisPlayerSeat = obj.seat;
                break;
            }
        }
    },

    /**
     * 获取用户座位号
     */
    _getSeatForPlayerUuid(playerUuid) {
        for (let i = 0; i < this._GameRoomCache.playerList.length; i += 1) {
            if (this._GameRoomCache.playerList[i].playerUuid === playerUuid) {
                return this._GameRoomCache.playerList[i].seat;
            }
        }
        return -1;
    },

});
