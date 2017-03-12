cc.Class({
    extends: cc.Component,

    properties: {
        input: cc.EditBox,
        info: cc.Label,
    },

    // use this for initialization
    onLoad() {

    },

    loginOnClick() {
        if (this.input.string.length !== 36) {
            this.info.string = '* 秘钥长度为: 36';
            return;
        }

        const self = this;
        const parameters = { wxCode: this.input.string, location: window.userLocation };
        HttpRequestManager.httpRequest('login', parameters, (event, result) => {
            if (result.getCode() === 1) {
                result = Tools.protobufToJson(result);
                result.location = window.userLocation;
                Tools.setLocalData(Global.localStorageKey.userInfo, result);
                Tools.setLocalData(Global.localStorageKey.secretKey, self.input.string);
                cc.director.loadScene('Lobby');
            }
            else {
                self.info.string = '* 登录失败, 秘钥错误';
            }
            Global.loading.close();
        });
    },

    closeOnClick() {
        Global.closeDialog(this.node);
    },
});
