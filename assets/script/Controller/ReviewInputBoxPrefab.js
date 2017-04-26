cc.Class({
    extends: cc.Component,

    properties: {
        number1: cc.Sprite,
        number2: cc.Sprite,
        number3: cc.Sprite,
        number4: cc.Sprite,
        number5: cc.Sprite,
        number6: cc.Sprite,
    },

    onLoad: function() {
        this.roomNumber = '';
    },

    init(fromScene) {
        this.fromScene = fromScene;
    },

    numberButtonOnClick(evt, data) {
        window.SoundEffect.playEffect(GlobalConfig.audioUrl.effect.buttonClick);
        if (this.roomNumber.length !== 6) {
            this.roomNumber += data;
            this[`number${this.roomNumber.length}`].spriteFrame = evt.target.children[0].getComponent(cc.Sprite).spriteFrame;
        }

        if (this.roomNumber.length === 6) {
            // TODO: 调用回放
        }
    },

    clearNumberOnClick() {
        window.SoundEffect.playEffect(GlobalConfig.audioUrl.effect.buttonClick);
        if (this.roomNumber.length !== 0) {
            for (let i = 1; i <= 6; i += 1) {
                this[`number${i}`].spriteFrame = null;
            }
            this.roomNumber = '';
        }
    },

    deleteNumberOnClick() {
        window.SoundEffect.playEffect(GlobalConfig.audioUrl.effect.buttonClick);
        cc.log(this.roomNumber);
        if (this.roomNumber.length !== 0) {
            this[`number${this.roomNumber.length}`].spriteFrame = null;
            this.roomNumber = this.roomNumber.substr(0, this.roomNumber.length - 1);
        }
    },

    /**
     * 关闭本窗口
     */
    closeOnClick() {
        window.SoundEffect.playEffect(GlobalConfig.audioUrl.effect.buttonClick);
        Animation.closeDialog(this.node);
    },

    _getHttpRoomEnterData() {
        window.Dialog.openLoading();

        const parameters = { roomId: this.roomNumber };
        HttpRequestManager.httpRequest('roomEnter', parameters, (event, result) => {
            window.Dialog.close();

            if (result.code === 1) {
                window.Dialog.close();
                GlobalConfig.tempCache = result;
                cc.director.loadScene('GameRoom');
            }
            else if (result.code === 1041) {
                window.Dialog.openMessageBox('房间号不存在');
            }
        });
    },
});
