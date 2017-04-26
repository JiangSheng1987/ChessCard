cc.Class({
    extends: cc.Component,

    properties: {
        avatar: cc.Sprite,
        ip: cc.Label,
        nickname: cc.Label,
        location: cc.Label,
    },

    // use this for initialization
    onLoad() {
        const userInfo = Global.tempCache;
        if (userInfo) {
            Tools.setWebImage(this.avatar, userInfo.headimgurl);
            this.ip.string = `IP地址: ${userInfo.ip}`;
            this.nickname.string = `昵称: ${userInfo.nickname}`;
            this.location.string = `所在地: ${userInfo.location}`;
        }
    },

    /**
     * 关闭本窗口
     */
    closeOnClick() {
        window.SoundEffect.playEffect(Global.audioUrl.effect.buttonClick);
        Animation.closeDialog(this.node);
    },
});
