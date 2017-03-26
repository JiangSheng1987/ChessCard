cc.Class({
    extends: cc.Component,

    properties: {
        playerList: {
            default: [],
            type: cc.Node,
        },

        testPrefab: cc.Prefab,

        cardPinList: cc.SpriteAtlas,
    },

    // use this for initialization
    onLoad() {
        for (let i = 0; i < this.playerList.length; i += 1) {
            const playerNode = this.playerList[i];
            const playerData = Global.tempCache.data.playerDataList[i];
            const cardPanel = playerNode.getChildByName('CardPanel');

            playerNode.getChildByName('text_nick').getComponent(cc.Label).string = this._getNicknameInList(playerData.playerUuid);
            playerNode.getChildByName('txt_fanshu').getComponent(cc.Label).string = `+${playerData.score}`;
            playerNode.getChildByName('txt_score').getComponent(cc.Label).string = playerData.total;

            for (let j = 0; j < playerData.cardsGroupList.length; j += 1) {
                const obj = playerData.cardsGroupList[j];
                const node = cc.instantiate(this.testPrefab);
                const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
                nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${obj.card.toString(16)}`);
                cardPanel.addChild(node);
            }

            for (let j = 0; j < playerData.cardsInHandList.length; j += 1) {
                const obj = playerData.cardsInHandList[j];
                const node = cc.instantiate(this.testPrefab);
                node.getChildByName('Background').setPositionX(24);

                const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
                nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${obj.card.toString(16)}`);
                cardPanel.addChild(node);
            }

            if (playerData.winType !== 0) {
                Tools.findNode(playerNode, `_Little>littleTxt_${playerData.winType}`).active = true;
                playerNode.getChildByName('WinType').getComponent(cc.Label).string = Global.winFlag[playerData.winFlag] || '';

                // 胡牌
                if ([1, 2].indexOf(playerData.winType) !== -1) {
                    playerNode.getChildByName('littleHuMark').active = true;

                    const node = cc.instantiate(this.testPrefab);
                    node.getChildByName('Background').setPositionX(48);
                    const nodeSprite = Tools.findNode(node, 'Background>value').getComponent(cc.Sprite);
                    nodeSprite.spriteFrame = this.cardPinList.getSpriteFrame(`value_0x${playerData.winCard.card.toString(16)}`);
                    cardPanel.addChild(node);
                }
            }
        }
    },

    wechatShareOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        // todo: 微信分享
    },

    gameAgenOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        const node = cc.director.getScene().getChildByName('Canvas');
        node.getComponent('GameRoomScene').onReadyGame();
        Global.closeDialog(this.node);
    },

    _getNicknameInList(playerUuid) {
        for (let i = 0; i < Global.tempCache.playerInfoList.length; i += 1) {
            const obj = Global.tempCache.playerInfoList[i];
            if (obj.playerUuid === playerUuid) {
                return obj.info.nickname;
            }
        }
        return false;
    },

});
