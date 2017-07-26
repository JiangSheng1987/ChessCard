var TouchMoveEnum = cc.Enum({
    None: -1,
    Begin: -1,
    Move: -1,
    End: -1,
});


cc.Class({
    extends: cc.Component,

    properties: {
        settingPrefab: cc.Prefab,
        userInfoPrefab: cc.Prefab,
        smallAccountPrefab: cc.Prefab,
        bigAccountPrefab: cc.Prefab,
        soundPrefab: cc.Prefab,

        roomInfo: [cc.Label],
        waitPanel: cc.Node,
        noBigPanel: cc.Node,
        hintPanel: [cc.Node],

        actionSprite: [cc.Node],
        clockNode: [cc.Node],

        playerInfoList: [cc.Node],
        inviteButtonList: [cc.Node],

        dipaiNode: cc.Node,

        cardPrefab: [cc.Prefab],
        cardPinList: cc.SpriteAtlas,

        handCardDistrict: cc.Node,
        dirtyCardDistrict: [cc.Node],

        actionNode: cc.Node,
        jiaofenModeButton: [cc.Node],
        jiaodizhuModeButton: [cc.Node],
        chupaiButton: [cc.Node],
        jiaofenSprate: [cc.Node],

        // 解散房间
        voteDismiss: cc.Node,
        voteSponsor: cc.Label,
        voteExpireSeconds: cc.Label,
        votePlayers: [cc.Node],
        voteDismissButton: [cc.Node],

        // 聊天面板
        fastChatPanel: cc.Node,
        fastChatProgressBar: cc.ProgressBar,
        voiceButton: cc.Node,
        voiceProgressBar: cc.ProgressBar,
        chatList: [cc.Node],
        emojiList: [cc.Prefab],
    },

    onLoad() {
        this._Cache = {};
        this._Cache.roomId = ''; // 房间号
        this._Cache.ownerUuid = ''; // 房主uuid
        this._Cache.playerList = []; // 玩家信息列表
        this._Cache.thisPlayerSeat = 0; // 当前玩家实际座位号
        this._Cache.thisDealerSeat = 0; // 当前庄家相对座位号
        this._Cache.settleForRoomData = null; // 大结算数据
        this._Cache.currentRound = 0; // 局数
        this._Cache.config = {}; // 房间信息
        this._Cache.robScore = -1;  // 叫分时最高分数
        this._Cache.outCardHelperData = []; // 出牌提示数据
        this._Cache.outCardHelperIndex = 0; // 提示出牌索引
        this._Cache.lastOutCards = [];      // 最后一次出的牌
        this._Cache.lastOutCardsPlayerUuid = '';    // 最后一次出牌玩家的 uuid
        this._Cache.dealCard = false;   // 是否是在发牌
        this._Cache.zhadanCount = 0;    // 出现炸弹次数

        window.Global.SoundEffect.backgroundMusicPlay(window.DDZ.Config.audioUrl.background, true);

        if (window.Global.Config.tempCache) {
            const self = this;
            this._Cache.roomId = window.Global.Config.tempCache.roomId;

            this.wsUrl = `ws://${window.Global.Config.tempCache.serverIp}:${window.Global.Config.tempCache.serverPort}/ws`;
            cc.log(this.wsUrl);
            window.Global.NetworkManager.onopen = () => {
                self._hideWaitPanel();
                window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.EnterRoom, { roomId: self._Cache.roomId });
                window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.Ready);

                this.unschedule(this.wsHbtSchedule);
                this.schedule(this.wsHbtSchedule, window.Global.Config.debug ? window.Global.Config.development.wsHbtTime : window.Global.Config.production.wsHbtTime);
            };
            window.Global.NetworkManager.onclose = () => {
                self.unschedule(self.wsHbtSchedule);
                self._showWaitPanel(2);
            };
            window.Global.NetworkManager.onmessage = (commandName, result) => {
                self[`on${commandName}Message`](result);
            };
            window.Global.NetworkManager.openSocketLink(this.wsUrl);

            this.roomInfo[0].string = `房间号: ${this._Cache.roomId}`;
        }

        this._userInfo = window.Global.Tools.getLocalData(window.Global.Config.LSK.userInfo);

        // 发送语音
        this.voiceButton.on(cc.Node.EventType.TOUCH_START, () => {
            // window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
            if (this.voiceProgressBar.progress > 0) {
                return;
            }
            this.voiceProgressBar.progress = 1.0;
            window.Global.NativeExtensionManager.execute('startRecord');
            cc.log('cc.Node.EventType.TOUCH_START');
        }, this);

        this.voiceButton.on(cc.Node.EventType.TOUCH_END, this.onVoiceEndCallback, this);
        this.voiceButton.on(cc.Node.EventType.TOUCH_CANCEL, this.onVoiceEndCallback, this);

        this._selectCatds();
        this._initScene();
    },

    update() {
        this.roomInfo[4].string = window.Global.Tools.formatDatetime('hh:ii:ss');
    },

    onDestroy() {
        window.Global.SoundEffect.backgroundMusicPlay(window.Global.Config.audioUrl.background.menu, true);
    },

    onVoiceEndCallback: function() {
        if (this.voiceProgressBar.progress != 1) {
            return;
        }

        this.schedule(function() {
            this.voiceProgressBar.progress -= 0.0025;
        }, 0.005, 400);

        var voiceFilePath = window.Global.NativeExtensionManager.execute('stopRecord');
        var webPath = window.Global.Config.aliyunOss.objectPath + window.Global.Tools.formatDatetime('yyyy/MM/dd/') + md5(+new Date() + Math.random().toString()) + '.amr';
        var parameters = [window.Global.Config.aliyunOss.bucketName, webPath, voiceFilePath];
        window.Global.NativeExtensionManager.execute('ossUpload', parameters, function(result) {
            if (result.result == 0) {
                const content = JSON.stringify({ type: 3, data: window.Global.Config.aliyunOss.domain + webPath });
                window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.Speaker, { content });
            }
        });
        cc.log('GameRoomScene.onVoiceEndCallback: ' + this.voiceFilePath);
    },

    wsHbtSchedule() {
        if (window.window.Global.NetworkManager.isClose) {
            this.unschedule(this.wsHbtSchedule);
            return;
        }
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.HeartBeat);
    },

    /**
     *******************************************************************************************************************
     *                                       public socket on message
     *******************************************************************************************************************
     **/

    onEnterRoomMessage(data) {
        if (data.code !== 1) {
            // cc.director.loadScene('Lobby');
            return;
        }

        data.currentRound = 1;
        data.baseScore = 0;
        data.multiple = 0;
        data.kwargs = JSON.parse(data.kwargs);
        this._Cache.gameUuid = data.kwargs.game_uuid;
        this._Cache.ownerUuid = data.ownerUuid;
        this._Cache.currentRound = 1;

        this._initScene();
        this._setRoomInfo(data);
        this._setThisPlayerSeat(data.playerList);

        // 初始化玩家信息
        for (var i = 0; i < data.playerList.length; i += 1) {
            var obj = data.playerList[i];
            obj.info = JSON.parse(obj.info);
            var playerIndex = this._getPlayerIndexBySeat(obj.seat);
            this._setPlayerInfoList(playerIndex, obj.info, obj.totalScore);

            this.inviteButtonList[playerIndex].active = false;
            this.playerInfoList[playerIndex].active = true;

            // 设置房主
            if (obj.playerUuid === data.ownerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_hostmark').active = true;
            }

            // 是否在线
            if (this._userInfo.playerUuid !== obj.playerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_offline').active = obj.isOnline === 0;
            }
        }

        this.inviteButtonList[0].active = (data.playerList.length !== 3);

        this._Cache.playerList = data.playerList;
        this._Cache.config = data.kwargs;
    },

    onEnterRoomOtherMessage(data) {
        if (data.code !== 1) {
            return;
        }

        data.info = JSON.parse(data.info);
        this._Cache.playerList.push(data);

        var playerIndex = this._getPlayerIndexBySeat(data.seat);

        this.inviteButtonList[playerIndex].active = false;
        this.playerInfoList[playerIndex].active = true;

        this.playerInfoList[playerIndex].getChildByName('text_nick').getComponent(cc.Label).string = data.info.nickname;
        this.playerInfoList[playerIndex].getChildByName('text_result').getComponent(cc.Label).string = data.totalScore || 0;
        window.Global.Tools.setWebImage(this.playerInfoList[playerIndex].getChildByName('mask').getChildByName('img_handNode').getComponent(cc.Sprite), data.info.headimgurl);

        // 设置房主
        this.playerInfoList[playerIndex].getChildByName('img_hostmark').active = data.playerUuid === this._Cache.ownerUuid;

        // 如果房间人数满了, 关闭邀请按钮
        this.inviteButtonList[0].active = this._Cache.playerList.length !== 3;

        // 检查是否在同一IP
        // this.scheduleOnce(function() {
        //     this._checkIp();
        // }, 2);
    },

    onReconnectDDZMessage(data) {
        if (this._Cache.dealCard) {
            this._reconnect = function () {
                this.onReconnectDDZMessage(data);
            };
            this.scheduleOnce(this._reconnect, 1);
            return;
        }

        data.kwargs = JSON.parse(data.kwargs);
        this._Cache.gameUuid = data.kwargs.game_uuid;
        this._Cache.roomId = data.roomId;
        this._Cache.ownerUuid = data.ownerUuid;
        this._Cache.currentRound = data.currentRound;
        this._Cache.config = data.kwargs;
        this._Cache.playerList = data.playerList;

        this._initScene();

        // 初始化房间信息
        this._setRoomInfo(data);

        // 设置当前玩家的座位号
        this._setThisPlayerSeat(data.playerList);

        // 初始化玩家信息
        for (var i = 0; i < data.playerList.length; i += 1) {
            var obj = data.playerList[i];
            obj.info = JSON.parse(obj.info);
            var playerIndex = this._getPlayerIndexBySeat(obj.seat);
            this._setPlayerInfoList(playerIndex, obj.info, obj.totalScore);

            this.inviteButtonList[playerIndex].active = false;
            this.playerInfoList[playerIndex].active = true;

            // 设置房主
            if (obj.playerUuid === data.ownerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_hostmark').active = true;
            }

            // 设置地主
            if (data.lairdPlayerUuid) {
                if (obj.playerUuid === data.lairdPlayerUuid) {
                    this.playerInfoList[playerIndex].getChildByName('table_dizhuTag').active = true;
                }
                else {
                    this.playerInfoList[playerIndex].getChildByName('table_nongminTag').active = true;
                }
            }

            // 是否在线
            if (this._userInfo.playerUuid !== obj.playerUuid) {
                this.playerInfoList[playerIndex].getChildByName('img_offline').active = obj.isOnline === 0;
            }

            // 初始化手牌
            if (playerIndex === 0) {
                for (var j = obj.cardsInHandList.length - 1; j >= 0; j -= 1) {
                    this._appendCardToHandCardDistrict(obj.cardsInHandList[j].card);
                }
                if (this.handCardDistrict.children.length > 1) {
                    window.Global.Tools.cardsSort(this.handCardDistrict.children);
                }
            }
            else {
                this._showCardNumber(playerIndex, obj.cardsInHandList.length);
            }

            // 抢地主分数显示
            if (data.roomStatus === window.DDZ.Config.roomStatusCode.RobState) {
                this._showFenshu(playerIndex, obj);
            }
        }

        window.DDZ.Tools.orderCard(this.handCardDistrict.children);

        // 判断是否在抢地主
        if (data.roomStatus === window.DDZ.Config.roomStatusCode.RobState) {
            if (this._userInfo.playerUuid === data.robPlayerUuid) {
                data.playerList.sort(function (a, b) {
                    return b.robScore - a.robScore;
                });
                this._Cache.robScore = data.playerList[0].robScore;
                this._showModButton(this._Cache.robScore);
            }
            var robPlayerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.robPlayerUuid));
            this._showClockNode(robPlayerIndex);
            this.dipaiNode.children[1].active = true;
        }
        else {
            var discardPlayerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.discardPlayerUuid));
            if (data.roomStatus !== window.DDZ.Config.roomStatusCode.InitState) {
                this._showClockNode(discardPlayerIndex);
                this.dipaiNode.children[1].active = true;
            }
        }

        // 初始化底牌
        if (data.threeCardsList.length > 0) {
            for (var i = 0; i < data.threeCardsList.length; i++) {
                this.dipaiNode.children[0].addChild(this._createCard(data.threeCardsList[i].card));
            }
        }

        // 初始化打出去的牌
        if (data.prevDiscardPlayerUuid) {
            var prevDiscardPlayerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.prevDiscardPlayerUuid));
            this._addCardToDiscardDistrict(prevDiscardPlayerIndex, data.prevDiscardCardsList);
        }

        // 判断当前出牌玩家
        if (data.discardPlayerUuid === this._userInfo.playerUuid) {
            this._Cache.lastOutCards = data.prevDiscardCardsList;
            this._Cache.lastOutCardsPlayerUuid = data.prevDiscardPlayerUuid;

            this.dirtyCardDistrict[0].removeAllChildren();
            this._activeChupaiButton(true);
            this._hideActionSprite(0);
            this._outCardHint();
        }

        this.inviteButtonList[0].active = (this._Cache.playerList.length !== 3);
    },

    onDiscardDDZMessage(data) {
        this._hideClockNode();
        this.noBigPanel.active = false;

        var playerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.playerUuid));
        this._addCardToDiscardDistrict(playerIndex, data.cardList);

        var playerInfo = this._getInfoByPlayerUuid(data.playerUuid);
        this._outCardEffect(data.cardType, data.cardList, playerInfo.sex);

        this._setCardNumber(playerIndex, data.cardList.length);

        if (data.cardList.length !== 0) {
            this._Cache.lastOutCards = data.cardList;
            this._Cache.lastOutCardsPlayerUuid = data.playerUuid;
        }

        if (this._userInfo.playerUuid === data.playerUuid) {
            this._activeChupaiButton(false);
            this._deleteHandCardByCode(data.cardList);
            this._resetHandCardPosition();
        }

        var cardNumber = this._getCardNumber(playerIndex);
        if (cardNumber === 1) {
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].baojing1);
        }
        else if (cardNumber === 2) {
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].baojing2);
        }

        // 出牌玩家
        if (data.nextDiscardPlayerUuid === this._userInfo.playerUuid) {
            this._activeChupaiButton(true);
            this.dirtyCardDistrict[0].removeAllChildren();
            this._outCardHint();
        }

        // 更新底分
        this._setDifeng(data.cardType);

        var nextDiscardPlayerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.nextDiscardPlayerUuid));
        this._showClockNode(nextDiscardPlayerIndex);
    },

    onOnlineStatusMessage(data) {
        const playerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.playerUuid));
        this.playerInfoList[playerIndex].getChildByName('img_offline').active = !data.status;
        if (this._Cache.playerList.length === 3) {
            if (data.status) {
                this._hideWaitPanel();
            } else {
                this._showWaitPanel(1);
            }
        }
    },

    onReadyMessage(data) {
        var playerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.playerUuid));
        this.playerInfoList[playerIndex].getChildByName('img_offline').active = false;
    },

    onSponsorVoteMessage(data) {
        this.voteDismissButton[0].active = true;
        this.voteDismissButton[1].active = true;

        this._votePlayers = [];
        for (let i = 0; i < this._Cache.playerList.length; i += 1) {
            const obj = this._Cache.playerList[i];
            if (obj.playerUuid === data.sponsor) {
                this.voteSponsor.string = obj.info.nickname;
            } else {
                this._votePlayers.push(obj);
            }
        }

        for (let i = 0; i < this._votePlayers.length; i += 1) {
            const obj = this._votePlayers[i];
            this.votePlayers[i].getChildByName('userTxt').getComponent(cc.Label).string = obj.info.nickname;
            this.votePlayers[i].active = true;
        }

        this.voteDismiss.active = true;

        // 如果是自己发起的投票, 就不需要再确认
        if (this._userInfo.playerUuid === data.sponsor) {
            data.expireSeconds = 1;

            this.voteDismissButton[0].active = false;
            this.voteDismissButton[1].active = false;

            this.voteExpireSeconds.string = '等待倒计时：0秒';
        } else {
            this.voteExpireSeconds.string = `等待倒计时：${data.expireSeconds}秒`;
        }

        const self = this;
        this._expireSeconds = () => {
            if (data.expireSeconds > 0) {
                data.expireSeconds -= 1;
                self.voteExpireSeconds.string = `等待倒计时：${data.expireSeconds}秒`;
            } else if (data.expireSeconds === 0) {
                self.unschedule(this._expireSeconds);
            }
        };
        this.schedule(this._expireSeconds, 1);
    },

    onDismissRoomMessage(data) {
        if (data.code === 5003) {
            window.Global.Dialog.openMessageBox('您不是房主, 无法解散房间');
            return;
        }

        if (data.code !== 1) {
            return;
        }

        if (data.flag === 0) {
            if (this._Cache.ownerUuid === this._userInfo.playerUuid) {
                window.Global.NetworkManager.close();
                cc.director.loadScene('Lobby');
            } else {
                window.Global.Dialog.openMessageBox('房主已解散房间', function() {
                    window.Global.NetworkManager.close();
                    cc.director.loadScene('Lobby');
                });
            }
        } else if (data.flag === 1) {
            window.Global.NetworkManager.close();
            cc.director.loadScene('Lobby');
        }
    },

    onExitRoomMessage(data) {
        if (data.playerUuid == this._userInfo.playerUuid) {
            window.Global.NetworkManager.close();
            cc.director.loadScene('Lobby');
            return;
        }

        var playerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.playerUuid));
        this._showInviteButton(playerIndex);
        this._hidePlayerInfoList([playerIndex]);

        // 从玩家列表中删除该用户
        for (let i = 0; i < this._Cache.playerList.length; i += 1) {
            if (this._Cache.playerList[i].playerUuid === data.playerUuid) {
                cc.js.array.removeAt(this._Cache.playerList, i);
                break;
            }
        }
    },

    onDealDDZMessage(data) {
        this._Cache.dealCard = true;

        this._initCardDistrict();

        // 初始化手牌
        var index = data.cardsInHandList.length - 1;
        this.schedule(() => {
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.effect.comm_deal_sound);
            this._appendCardToHandCardDistrict(data.cardsInHandList[index].card);
            index -= 1;
            if (index === -1) {
                window.DDZ.Tools.orderCard(this.handCardDistrict.children);
                this._Cache.dealCard = false;
            }
        }, 0.1, data.cardsInHandList.length - 1);


        // 初始化其他玩家的手牌数量
        for (var j = 1; j < 3; j += 1) {
            this._showCardNumber(j, data.cardsInHandList.length);
        }

        // 设置底牌
        this.dipaiNode.children[0].removeAllChildren();
        for (var i = 0; i < data.threeCardsList.length; i++) {
            this.dipaiNode.children[0].addChild(this._createCard(data.threeCardsList[i].card));
        }

        if (this._userInfo.playerUuid === data.firstRobUuid) {
            this._showModButton(this._Cache.robScore);
        }
    },

    onRobDDZMessage(data) {
        // 音频
        var playerInfo = this._getInfoByPlayerUuid(data.playerUuid);
        if ((this._Cache.config.options & 0b10) !== 0) {
            if (data.flag === 1) {
                window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].order);
            }
            else {
                window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].noRob);
            }
        }
        else if (data.score === 0) {
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].noRob);
        }
        else if (data.score > 0) {
            if (this._Cache.robScore === -1 || this._Cache.robScore === 0) {
                window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].order);
            }
            else {
                window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[playerInfo.sex === 1 ? 'man' : 'woman'].rob1);
            }
        }

        // 更新叫分时的最高分
        if (this._Cache.robScore < data.score) {
            this._Cache.robScore = data.score;
        }
        // 如果下一个叫分玩家是自己就显示叫分按钮
        if (this._userInfo.playerUuid === data.nextRobPlayerUuid) {
            this._showModButton(this._Cache.robScore);
        }

        // 如果是自己叫分, 就把自己的叫分按钮隐藏
        if (this._userInfo.playerUuid === data.playerUuid) {
            this._hideActionNode();
        }

        // 显示叫分玩家叫的分数
        var playerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.playerUuid));
        this._showFenshu(playerIndex, data);

        if (data.nextRobPlayerUuid) {
            var nextRobPlayerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.nextRobPlayerUuid));
            this._showClockNode(nextRobPlayerIndex);
        }

        // 是否已经有人成为地主
        if (data.lairdPlayerUuid) {
            this._hideJiaofenSprite();
            var lairdPayerIndex = this._getPlayerIndexBySeat(this._getSeatForPlayerUuid(data.lairdPlayerUuid));
            this._showDizhuPanel(lairdPayerIndex);
            this.dipaiNode.children[1].active = false;
            // 添加底牌给地主
            if (this._userInfo.playerUuid === data.lairdPlayerUuid) {
                for (var i = 0; i < this.dipaiNode.children[0].children.length; i++) {
                    var obj = this.dipaiNode.children[0].children[i];
                    this.handCardDistrict.addChild(this._createCard(obj._userData));
                }

                this._activeChupaiButton(true);
                window.DDZ.Tools.orderCard(this.handCardDistrict.children);
                this._Cache.lastOutCardsPlayerUuid = this._userInfo.playerUuid;
                this._outCardHint();
            }
            this.roomInfo[2].string = this._Cache.robScore === -1 ? 1 : this._Cache.robScore;
            this._Cache.robScore = -1;
        }
        // 如果没人成为地主, 并且没有下一个叫分的玩家, 需要重新发牌
        else if (!data.nextRobPlayerUuid) {
            this._hideJiaofenSprite();
            this._initCardDistrict();
        }
    },

    onPlayerVoteMessage(data) {
        if (!data.flag) {
            this.voteDismiss.active = false;
            return;
        }
        for (let i = 0; i < this._votePlayers.length; i += 1) {
            const obj = this._votePlayers[i];
            if (obj.playerUuid === data.playerUuid) {
                this.votePlayers[i].getChildByName('userSelectTxt').getComponent(cc.Label).string = data.flag ? '同意' : '拒绝';
            }
        }
    },

    onSpeakerMessage(data) {
        data.content = JSON.parse(data.content);

        // 语音
        if (data.content.type === 3 && this._userInfo.playerUuid !== data.playerUuid) {
            if (cc.sys.os === cc.sys.OS_IOS) {
                var filePath = data.content.data.replace(window.Global.Config.aliyunOss.domain, '');
                window.Global.NativeExtensionManager.execute('ossDownload', [window.Global.Config.aliyunOss.bucketName, filePath], (result) => {
                    if (result.result == 0) {
                        window.Global.NativeExtensionManager.execute('playerAudio', [result.data]);
                    }
                });
            } else if (cc.sys.os === cc.sys.OS_ANDROID) {
                window.Global.NativeExtensionManager.execute('playerAudio', [data.content.data]);
            }
            return;
        }

        for (let i = 0; i < this._Cache.playerList.length; i += 1) {
            if (this._Cache.playerList[i].playerUuid === data.playerUuid) {
                const playerIndex = this._getPlayerIndexBySeat(this._Cache.playerList[i].seat);
                const self = this;

                // 评论
                if (data.content.type === 1) {
                    window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.fastChat[`fw_${this._Cache.playerList[i].info.sex === 1 ? 'male' : 'female'}_${data.content.data}`]);
                    const text = window.Global.Tools.findNode(this.fastChatPanel, `fastChatView1>content>fastViewItem${data.content.data}>Label`).getComponent(cc.Label).string;
                    this.chatList[playerIndex].getChildByName('txtMsg').getComponent(cc.Label).string = text;
                    this.chatList[playerIndex].active = true;
                    this.scheduleOnce(() => {
                        self.chatList[playerIndex].active = false;
                    }, 3);
                }
                // 表情
                else if (data.content.type === 2) {
                    const node = cc.instantiate(this.emojiList[data.content.data - 1]);
                    if (playerIndex === 0) {
                        node.setPosition(0, -126);
                    }
                    else if (playerIndex === 1) {
                        node.setPosition(162, 0);
                        node.rotation = 270;
                    }
                    else if (playerIndex === 2) {
                        node.setPosition(0, 126);
                        node.rotation = 180;
                    }
                    else if (playerIndex === 3) {
                        node.setPosition(-162, 0);
                        node.rotation = 90;
                    }

                    this.node.addChild(node);
                    this.scheduleOnce(() => {
                        node.destroy();
                    }, 3);
                }
                break;
            }
        }
    },

    onSettleForRoundDDZMessage(data) {
        this._initCardDistrict();
        this._hideActionNode();
        const self = this;
        const node = cc.instantiate(this.smallAccountPrefab);
        node.getComponent('DDZSmallAccount').init({ data: data, playerInfoList: this._Cache.playerList });
        window.Global.Animation.openDialog(node, this.node, () => {
            self._hideDipaiNode();
        });
    },

    onSettleForRoomDDZMessage(data) {
        if (this.voteDismiss.active || this._Cache.settleForRoomData) {
            this.voteDismiss.active = false;
            window.Global.NetworkManager.close();
            var node = cc.instantiate(this.bigAccountPrefab);
            node.getComponent('DDZBigAccount').init({
                data: data, playerInfoList: this._Cache.playerList,
                gameRule: this.roomInfo[3].string,
                roomId: this.roomInfo[0].string,
                ownerUuid: this._Cache.ownerUuid
            });
            window.Global.Animation.openDialog(node, this.node);
        } else {
            this._Cache.settleForRoomData = data;
        }
    },

    /**
     *******************************************************************************************************************
     *                                       onClick
     *******************************************************************************************************************
     */

    /**
     * 声音选项
     */
    openSoundPanelOnClick() {
        // window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        window.Global.Animation.openDialog(cc.instantiate(this.soundPrefab), this.node, () => {
            cc.log('load success');
        });
    },

    /**
     * 解散房间
     */
    dismissOnClick() {
        // window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.DismissRoom);
    },

    voteOnClick(evt, data) {
        // window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.PlayerVote, { flag: data == 1 });

        this.voteDismissButton[0].active = false;
        this.voteDismissButton[1].active = false;

        this.unschedule(this._expireSeconds);
    },

    /**
     * 微信邀请
     */
    wechatInviteOnClick() {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);

        const hasWechat = window.Global.NativeExtensionManager.execute('wechatIsWxAppInstalled');
        if (!hasWechat) {
            cc.log('MyRoomPrefab.shareOnClick: 没有安装微信');
            return;
        }

        var shareInfo = window.Global.Tools.createWechatShareInfo(this._Cache.config, this._Cache.roomId);
        window.Global.NativeExtensionManager.execute('wechatLinkShare', [window.Global.Config.downloadPage, shareInfo[0], shareInfo[1]]);
        cc.log('shareOnClick');
    },

    closeDialogOnClick() {
        // 检查是否关闭聊天面板
        if (this.fastChatPanel.getPositionX() < 568) {
            this.fastChatPanel.getComponent(cc.Animation).play('CloseFastChatPanel');
        }

        this._resetHandCardPosition();
    },

    openFastChatPanelOnClick() {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        if (this.fastChatProgressBar.progress <= 0) {
            var animationName = (this.fastChatPanel.getPositionX() >= 568) ? 'OpenFastChatPanel' : 'CloseFastChatPanel';
            this.fastChatPanel.getComponent(cc.Animation).play(animationName);
        }
    },

    switchFastChatPanelOnClick(evt, data) {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        if (data == 1) {
            this.fastChatPanel.getChildByName('fastChatView1').active = true;
            this.fastChatPanel.getChildByName('fastChatView2').active = false;
        } else {
            this.fastChatPanel.getChildByName('fastChatView1').active = false;
            this.fastChatPanel.getChildByName('fastChatView2').active = true;
        }
    },

    wordChatOnClick(evt, data) {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        const content = JSON.stringify({ type: 1, data });
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.Speaker, { content });

        this.fastChatProgressBar.progress = 1.0;
        this.schedule(function() {
            this.fastChatProgressBar.progress -= 0.0025;
        }, 0.005, 400);

        this.fastChatPanel.getComponent(cc.Animation).play('CloseFastChatPanel');
    },

    emojiChatOnClick(evt, data) {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        const content = JSON.stringify({ type: 2, data });
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.Speaker, { content });

        this.fastChatProgressBar.progress = 1.0;
        this.schedule(function() {
            this.fastChatProgressBar.progress -= 0.0025;
        }, 0.005, 400);

        this.fastChatPanel.getComponent(cc.Animation).play('CloseFastChatPanel');
    },

    /**
     * 叫分模式按钮回调
     */

    jiaofenOnClick(event, data) {
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.RobDDZ, {flag: data > 0 ? 1 : 2, score: parseInt(data, 10)});
    },

    jiaodizhuOnClick(event, data) {
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.RobDDZ, {flag: parseInt(data, 10), score: 1});
    },

    chupaiOnClick(event, data) {
        if (data == 0) {
            var discards = this._getDiscardValues();
            if (discards.length === 0) {
                this._showHintPanel(0);
                cc.log('请选择要出的牌');
                return;
            }

            if (this._Cache.lastOutCardsPlayerUuid && this._Cache.lastOutCardsPlayerUuid !== this._userInfo.playerUuid) {
                var prevDiscardCardValues = window.DDZ.Tools.getCardValues(this._Cache.lastOutCards);
                var cardType = window.DDZ.Tools.getCardType(prevDiscardCardValues);
                var outCardHelperData = window.DDZ.Tools.solutionHelper.parse(cardType, discards);
                if (outCardHelperData.length === 0) {
                    this._showHintPanel(1);
                    cc.log('您选择的牌小于上家的牌');
                    return;
                }
            }
            this._discard(discards);
        }
        else if (data == 1) {
            if (this._Cache.outCardHelperData.length === 0) {
                cc.log('显示没有更大牌的提示');
                return;
            }
            if (this._Cache.outCardHelperData.length <= this._Cache.outCardHelperIndex) {
                this._Cache.outCardHelperIndex = 0;
            }
            this._resetHandCardPosition();
            var outCardHelperData = this._Cache.outCardHelperData[this._Cache.outCardHelperIndex];
            for (var i = 0; i < this.handCardDistrict.children.length; i += 1) {
                var obj = this.handCardDistrict.children[i];
                for (var j = 0; j < outCardHelperData.length; j += 1) {
                    var data = outCardHelperData[j];
                    if (obj._userData === data) {
                        obj.setPositionY(24);
                    }
                }
            }
            this._Cache.outCardHelperIndex += 1;
        }
        else if (data == 2) {
            this._discard([]);
        }
    },

    _getDiscardValues() {
        var discardValues = [];
        for (var i = 0; i < this.handCardDistrict.children.length; i += 1) {
            var card = this.handCardDistrict.children[i];
            if (card.getPositionY() > 0) {
                discardValues.push(card._userData);
            }
        }
        return discardValues;
    },

    _discard(data) {
        window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.DiscardDDZ, { cards: data });
        // window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.effect.cardOut);  // 胡牌音效
    },

    closeOnClick() {
        // window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        if (this._Cache.playerList.length !== 3) {
            window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.ExitRoom, { roomId: this._Cache.roomId });
        } else {
            window.Global.Dialog.openMessageBox('游戏中无法退出');
        }
    },

    /**
     *******************************************************************************************************************
     *                                       callback
     *******************************************************************************************************************
     **/

    readyGameCallback() {
        if (this._Cache.settleForRoomData) {
            this.onSettleForRoomDDZMessage(this._Cache.settleForRoomData);
        }
        else if (this.handCardDistrict.children.length === 0) {
            cc.log('readyGameCallback.Ready');
            window.Global.NetworkManager.sendSocketMessage(window.PX258.NetworkConfig.WebSocket.Ready);
            this.roomInfo[1].string = `局数: ${this._Cache.currentRound += 1}/${this._Cache.config.max_rounds}`;
        }
    },

    /**
     *******************************************************************************************************************
     *                                       function
     *******************************************************************************************************************
     */

    /**
     * 动作提示, 比如: 要不起
     */
    _hideActionSprite(playerIndex) {
        if (typeof playerIndex === 'undefined') {
            for (var i = 0; i < this.actionSprite.length; i++) {
                for (var j = 0; j < this.actionSprite[i].children.length; j += 1) {
                    this.actionSprite[i].children[j].active = false;
                }
            }
        }
        else {
            for (var j = 0; j < this.actionSprite[playerIndex].children.length; j += 1) {
                this.actionSprite[playerIndex].children[j].active = false;
            }
        }
    },

    _showActionSprite(playerIndex, cardType) {
        var actionChildren = this.actionSprite[playerIndex].children;

        // todo: 根据不同的牌形显示不同的提示
        if (cardType === window.DDZ.Config.cardType.PASS) {
            actionChildren[0].active = true;
        }
    },

    /**
     * 倒计时时钟
     */
    _hideClockNode() {
        for (var i = 0; i < this.clockNode.length; i++) {
            this.clockNode[i].active = false;
        }
    },

    _showClockNode(playerIndex) {
        this.unschedule(this._clockTimer);
        this.clockNode[playerIndex].active = true;
        var label = this.clockNode[playerIndex].getChildByName('Number').getComponent(cc.Label);
        var time = 30;

        label.string = time;
        this._clockTimer = function () {
            time -= 1;
            if (time === -1) {
                this.clockNode[playerIndex].active = false;
            }
            else {
                label.string = time;
            }
        };
        this.schedule(this._clockTimer, 1, 30);
    },

    /**
     * 玩家信息
     */
    _hidePlayerInfoList() {
        for (let i = 0; i < this.playerInfoList.length; i += 1) {
            this.playerInfoList[i].active = false;
        }
    },

    _showPlayerInfoList(index) {
        this.playerInfoList[index].active = true;
    },

    /**
     * 邀请按钮
     */
    _hideInviteButtonList() {
        for (let i = 0; i < this.inviteButtonList.length; i += 1) {
            this.inviteButtonList[i].active = false;
        }
    },

    _showInviteButtonList(index) {
        this.inviteButtonList[index].active = true;
    },

    /**
     * 叫分模式
     */
    _hideJiaofenModButton() {
        for (let i = 0; i < this.jiaofenModeButton.length; i += 1) {
            this.jiaofenModeButton[i].active = false;
        }
    },

    _showJiaofenModButton(score) {
        for (let i = 0; i < this.jiaofenModeButton.length; i += 1) {
            if (i > score) {
                this.jiaofenModeButton[i].active = true;
            }
        }
        this.jiaofenModeButton[0].active = true;
    },

    /**
     * 叫地主模式
     */
    _activeJiaodizhuModButton(active) {
        for (let i = 0; i < this.jiaodizhuModeButton.length; i += 1) {
            this.jiaodizhuModeButton[i].active = active;
        }
    },

    /**
     * 出牌按钮
     */
    _hideChupaiButton(active) {
        for (let i = 0; i < this.chupaiButton.length; i += 1) {
            this.chupaiButton[i].active = active;
        }
    },

    _activeChupaiButton(active) {
        for (let i = 0; i < this.chupaiButton.length; i += 1) {
            this.chupaiButton[i].active = active;
        }
    },

    /**
     * 添加牌到手牌区
     *
     * @param card
     * @private
     */
    _appendCardToHandCardDistrict(card) {
        var node = this._createCard(card);
        this.handCardDistrict.addChild(node);
    },

    /**
     * 构造每张牌
     */
    _createCard(card) {
        var cardValue = window.DDZ.Tools.getCardVo(card);
        var node;

        if (cardValue.suit === 5) {
            node = cc.instantiate(this.cardPrefab[cardValue.value === 17 ? 2 : 1]);
        }
        else {
            node = cc.instantiate(this.cardPrefab[0]);

            var color = [1, 3].indexOf(cardValue.suit) !== -1 ? 'black' : 'red';

            var nodeSpriteChildren = node.getChildByName('Background').children;
            nodeSpriteChildren[0].getComponent(cc.Sprite).spriteFrame = this.cardPinList.getSpriteFrame(cardValue.value + '_' + color);
            nodeSpriteChildren[1].getComponent(cc.Sprite).spriteFrame = this.cardPinList.getSpriteFrame(cardValue.suit);
            nodeSpriteChildren[2].getComponent(cc.Sprite).spriteFrame = this.cardPinList.getSpriteFrame(cardValue.suit);
        }

        node._userData = card;

        return node;
    },

    /**
     * 添加牌到打出去的区域
     *
     * @param playerIndex
     * @param cards
     * @private
     */
    _addCardToDiscardDistrict(playerIndex, cards) {
        this._hideActionSprite();
        this.dirtyCardDistrict[playerIndex].removeAllChildren();
        for (var i = 0; i < cards.length; i += 1) {
            var node = this._createCard(cards[i].card);
            this.dirtyCardDistrict[playerIndex].addChild(node);
        }

        if (cards.length === 0) {
            this.actionSprite[playerIndex].children[0].active = true;
        }

        window.DDZ.Tools.orderCard(this.dirtyCardDistrict[playerIndex].children);
    },

    _outCardEffect(cardType, data, sex) {
        sex = sex || 1;
        sex = sex === 1 ? 'man' : 'woman';
        switch (cardType) {
        case window.DDZ.Config.cardType.DANZ:  // 单张
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex][`dz_${data[0].card}`]);
            break;
        case window.DDZ.Config.cardType.YDUI:  // 一对
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex][`dui_${data[0].card}`]);
            break;
        case window.DDZ.Config.cardType.SANZ:  // 三张牌（什么也不带）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].sange);
            break;
        case window.DDZ.Config.cardType.SDYI:  // 三带一（带一张单牌）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].sandaiyi);
            break;
        case window.DDZ.Config.cardType.SDER:  // 三带二（带一对）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].sandaiyidui);
            break;
        case window.DDZ.Config.cardType.DANS:  // 单顺子
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].shunzi);
            break;
        case window.DDZ.Config.cardType.LDUI:  // 连对（双顺子）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].liandui);
            break;
        case window.DDZ.Config.cardType.SANS:  // 三顺子，飞机（什么都不带）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].feiji);
            break;
        case window.DDZ.Config.cardType.SSDY:  // 三顺子，飞机（带单牌）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].feiji);
            break;
        case window.DDZ.Config.cardType.SSDE:  // 三顺子，飞机（带对）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].feiji);
            break;
        case window.DDZ.Config.cardType.ZHAD:  // 炸弹
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].zhadan);
            break;
        case window.DDZ.Config.cardType.HUOJ:  // 王炸，火箭
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].wangzha);
            break;
        case window.DDZ.Config.cardType.SDLZ:  // 四带二（带两张单牌）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].sidaier);
            break;
        case window.DDZ.Config.cardType.SDLD:  // 四带二（带两对）
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex].sidaier);
            break;
        case window.DDZ.Config.cardType.PASS:  // pass
            window.Global.SoundEffect.playEffect(window.DDZ.Config.audioUrl.common[sex][`buyao${Math.ceil(Math.random() * 4)}`]);
            break;
        default:
            break;
        }
    },

    remiveCardFromDiscardDistrict(playerIndex) {
        this.dirtyCardDistrict[playerIndex].removeAllChilden();
    },

    /**
     * 设置房间信息
     *
     * @param {Object} data
     * @private
     */
    _setRoomInfo(data) {
        // 游戏玩法
        var playTypes = window.PX258.Config.playTypes[data.kwargs.game_uuid];
        var options = `0b${data.kwargs.options.toString(2)}`;

        if (data.kwargs.game_uuid == window.PX258.Config.gameUuid[2]) {
            for (var key in playTypes.playType) {
                if ((options & key) !== 0) {
                    this.roomInfo[3].string = playTypes.playType[key] + '玩法';
                }
            }

            for (var key in playTypes.options) {
                if ((options & key) !== 0) {
                    this.roomInfo[3].string += '\n炸弹上限: ' + playTypes.options[key];
                }
            }
        }

        this.roomInfo[0].string = `房间号: ${this._Cache.roomId}`;
        this.roomInfo[1].string = `局数: ${data.currentRound}/${data.kwargs.max_rounds}`;
        this.roomInfo[2].string = data.baseScore * data.multiple;
    },

    _setDifeng(cardType) {
        var zhadanCount = 0;
        var playTypes = window.PX258.Config.playTypes[this._Cache.config.game_uuid];
        var options = `0b${this._Cache.config.options.toString(2)}`;
        var keys = Object.keys(playTypes.options);
        if ((options & keys[0]) !== 0) {
            zhadanCount = 3;
        }
        else if ((options & keys[1]) !== 0) {
            zhadanCount = 4;
        }
        else if ((options & keys[2]) !== 0) {
            zhadanCount = 5;
        }

        if (this._Cache.zhadanCount >= zhadanCount) {
            return;
        }

        this._Cache.zhadanCount += 1;

        if (window.DDZ.Config.cardType.ZHAD === cardType || window.DDZ.Config.cardType.HUOJ === cardType) {
            this.roomInfo[2].string *= 2;
        }
    },

    _showWaitPanel(messageId) {
        if (messageId === 1) {
            this.waitPanel.getComponent(cc.Label).string = '玩家可能离线或者离开，等待操作中...';
        } else if (messageId === 2) {
            this.waitPanel.getComponent(cc.Label).string = '断线重连中，请稍等...';
        }
        this.waitPanel.active = true;
    },

    _hideWaitPanel() {
        this.waitPanel.active = false;
    },

    _hideJiaofenSprite() {
        for (var i = 0; i < this.jiaofenSprate.length; i += 1) {
            for (var j = 0; j < this.jiaofenSprate[i].children.length; j += 1) {
                this.jiaofenSprate[i].children[j].active = false;
            }
        }
    },

    _showDizhuPanel(playerIndex) {
        this._hideDizhuPanel();
        for (var i = 0; i < this.playerInfoList.length; i += 1) {
            if (i === playerIndex) {
                this.playerInfoList[i].getChildByName('table_dizhuTag').active = true;
            }
            else {
                this.playerInfoList[i].getChildByName('table_nongminTag').active = true;
            }
        }
    },

    _hideDizhuPanel() {
        for (var i = 0; i < this.playerInfoList.length; i += 1) {
            this.playerInfoList[i].getChildByName('table_dizhuTag').active = false;
            this.playerInfoList[i].getChildByName('table_nongminTag').active = false;
        }
    },

    _showFenshu(playerIndex, data) {
        if ((this._Cache.config.options & 0b10) !== 0) {
            var flag = data.robFlag || data.flag;

            if (flag === 2) {
                this.jiaofenSprate[playerIndex].children[0].active = true;
            }
        }
        else {
            var score = data.robScore || data.score;
            if (score !== -1) {
                this.jiaofenSprate[playerIndex].children[score].active = true;
            }
        }
    },

    _showModButton(score) {
        if ((this._Cache.config.options & 0b10) !== 0) {
            this._activeJiaodizhuModButton(true);
        }
        else {
            this._showJiaofenModButton(score);
        }
    },

    _hideActionNode() {
        for (var i = 0; i < this.actionNode.children.length; i++) {
            this.actionNode.children[i].active = false;
        }
    },

    _initScene() {
        for (var i = 0; i < this.playerInfoList.length; i++) {
            this.playerInfoList[i].active = false;
            this.inviteButtonList[i].active = true;
            this.dirtyCardDistrict[i].removeAllChildren();
        }
        this.handCardDistrict.removeAllChildren();

        this._Cache.zhadanCount = 0;

        this._hideJiaofenSprite();
        this._hideActionNode();
        this._hideActionSprite();
        this._hideDipaiNode();
        this._hideClockNode();
    },

    _hideDipaiNode() {
        this.dipaiNode.children[1].active = true;
        this.dipaiNode.children[0].removeAllChildren();
    },

    _showHintPanel(index) {
        this.hintPanel[index].active = true;

        this.scheduleOnce(function () {
            this.hintPanel[index].active = false;
        }, 2);
    },

    /**
     * 获取用户座位号
     */
    _getSeatForPlayerUuid(playerUuid) {
        for (let i = 0; i < this._Cache.playerList.length; i += 1) {
            if (this._Cache.playerList[i].playerUuid === playerUuid) {
                return this._Cache.playerList[i].seat;
            }
        }
        return -1;
    },

    _getInfoByPlayerUuid(playerUuid) {
        for (let i = 0; i < this._Cache.playerList.length; i += 1) {
            if (this._Cache.playerList[i].playerUuid === playerUuid) {
                return this._Cache.playerList[i].info;
            }
        }
        return -1;
    },

    _getPlayerIndexBySeat(playerSeat) {
        var displaySeat = playerSeat - this._Cache.thisPlayerSeat;
        return (displaySeat < 0 ? displaySeat + 3 : displaySeat);
    },

    /**
     * 设置当前玩家座位号
     */
    _setThisPlayerSeat(playerList) {
        for (let i = 0; i < playerList.length; i += 1) {
            var obj = playerList[i];
            if (obj.playerUuid === this._userInfo.playerUuid) {
                this._Cache.thisPlayerSeat = obj.seat;
                break;
            }
        }
    },

    _setPlayerInfoList(playerIndex, data, totalScore) {
        if (this._Cache.playerList.length === 3 && playerIndex === 0) {
            this.inviteButtonList[playerIndex].active = false;
        }
        this.playerInfoList[playerIndex].active = true;

        this.playerInfoList[playerIndex].getChildByName('text_nick').getComponent(cc.Label).string = data.nickname;
        this.playerInfoList[playerIndex].getChildByName('text_result').getComponent(cc.Label).string = totalScore || 0;
        window.Global.Tools.setWebImage(this.playerInfoList[playerIndex].getChildByName('mask').getChildByName('img_handNode').getComponent(cc.Sprite), data.headimgurl);
    },

    _initCardDistrict() {
        for (var i = 0; i < this.dirtyCardDistrict.length; i++) {
            this.dirtyCardDistrict[i].removeAllChildren();
        }
        this.handCardDistrict.removeAllChildren();

        this.roomInfo[2].string = 0;
        this._Cache.zhadanCount = 0;
        this.noBigPanel.active = false;
        this._hideDizhuPanel();
    },

    _showCardNumber(playerIndex, number) {
        var cardNumberNode = this.playerInfoList[playerIndex].getChildByName('cardNumber');
        cardNumberNode.active = true;
        cardNumberNode.getChildByName('Number').getComponent(cc.Label).string = number;
    },

    _getCardNumber(playerIndex) {
        if (playerIndex === 0) {
            return this.handCardDistrict.childrenCount;
        }
        var cardNumberNode = this.playerInfoList[playerIndex].getChildByName('cardNumber');
        return cardNumberNode.getChildByName('Number').getComponent(cc.Label).string;
    },

    _setCardNumber(playerIndex, num) {
        if (playerIndex === 0) {
            return;
        }
        var cardNumber = this._getCardNumber(playerIndex) - num;
        this._showCardNumber(playerIndex, cardNumber);
    },

    _resetHandCardPosition() {
        for (let i = 0; i < this.handCardDistrict.childrenCount; i += 1) {
            this.handCardDistrict.children[i].setPositionY(0);
        }
    },

    /**
     * 滑动选择卡牌
     *
     * @author Make.<makehuir@gmail.com>
     * @datetime 2017-07-12T16:04:33+0800
     *
     * @return   {[type]}                 [description]
     */
    _selectCatds() {
        this._touchMoveBySelectCards = function(event) {
            cc.log('cc.Node.EventType.TOUCH_MOVE');
            this._touchMoveEnum = TouchMoveEnum.Move;
            for (var i = 0; i < this.handCardDistrict.children.length; i++) {
                var pos = this.handCardDistrict.children[i].convertToNodeSpace(event.getLocation());
                cc.log([event.getLocation(), pos]);
                // 修正右手第一张牌的选取范围
                var endPosX = i === (this.handCardDistrict.children.length - 1) ? 106 : 40;
                // 是否被选中
                if (pos.x > 0 && pos.x <= endPosX) {
                    this.handCardDistrict.children[i].getChildByName('Background').getChildByName('mask').active = true;
                }
            }
        };

        this._touchEndBySelectCards = function() {
            cc.log('cc.Node.EventType.TOUCH_END');
            if (this._touchMoveEnum === TouchMoveEnum.Begin) {
                this._touchMoveBySelectCards(this._touchMoveBeginEvent);
            }
            for (var i = 0; i < this.handCardDistrict.children.length; i++) {
                // 设置牌是否为选中状态
                cc.log(this.handCardDistrict.children[i].getChildByName('Background').getChildByName('mask').active);
                if (this.handCardDistrict.children[i].getChildByName('Background').getChildByName('mask').active) {
                    if (this.handCardDistrict.children[i].getPositionY() == 0) {
                        this.handCardDistrict.children[i].setPositionY(24);
                    } else {
                        this.handCardDistrict.children[i].setPositionY(0);
                    }
                }
                this.handCardDistrict.children[i].getChildByName('Background').getChildByName('mask').active = false;
            }
            this._touchMoveEnum = TouchMoveEnum.End;
        };

        this.handCardDistrict.on(cc.Node.EventType.TOUCH_START, function(event) {
            cc.log('c.Node.EventType.TOUCH_START');
            this._touchMoveEnum = TouchMoveEnum.Begin;
            this._touchMoveBeginEvent = event;
        }, this);

        this.handCardDistrict.on(cc.Node.EventType.TOUCH_MOVE, this._touchMoveBySelectCards, this);
        this.handCardDistrict.on(cc.Node.EventType.TOUCH_END, this._touchEndBySelectCards, this);
        this.handCardDistrict.on(cc.Node.EventType.TOUCH_CANCEL, this._touchEndBySelectCards, this);
    },

    _deleteHandCardByCode(values) {
        var cardValues = [];
        if (values[0]) {
            for (var i = 0; i < values.length; i += 1) {
                cardValues.push(values[i].card);
            }
        }
        else {
            cardValues = values;
        }

        if (cardValues.length === 0) {
            return;
        }

        for (var i = 0; i < this.handCardDistrict.children.length; i += 1) {
            var card = this.handCardDistrict.children[i];
            var index = cardValues.indexOf(card._userData);
            if (index !== -1) {
                card.destroy();
                cardValues.splice(index, 1);
            }
            if (cardValues.length === 0) {
                break;
            }
        }
    },

    /**
     * 计算出牌提示
     * @private
     */
    _outCardHint() {
        var selfCardValues = window.DDZ.Tools.getCardValues(this.handCardDistrict.children);
        if (this._Cache.lastOutCardsPlayerUuid && this._Cache.lastOutCardsPlayerUuid !== this._userInfo.playerUuid) {
            var prevDiscardCardValues = window.DDZ.Tools.getCardValues(this._Cache.lastOutCards);
            var cardType = window.DDZ.Tools.getCardType(prevDiscardCardValues);
            this._Cache.outCardHelperData = window.DDZ.Tools.solutionHelper.parse(cardType, selfCardValues);
        }
        else {
            this._Cache.outCardHelperData = window.DDZ.Tools.firstOutCardHelper.parse(selfCardValues);
        }
        this._Cache.outCardHelperIndex = 0;
        this.noBigPanel.active = this._Cache.outCardHelperData.length === 0;
    }

});