cc.Class({
    extends: cc.Component,

    properties: {
        musicToggle: cc.Toggle,
        voiceToggle: cc.Toggle,
    },

    // use this for initialization
    onLoad() {
        this.playMusicConfig = Tools.getLocalData(Global.LSK.playMusicConfig);

        this.musicToggle.isChecked = this.playMusicConfig.music;
        this.voiceToggle.isChecked = this.playMusicConfig.effect;
    },

    musicToggleOnClick(target) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        this.playMusicConfig.music = target.isChecked;
        Tools.setLocalData(Global.LSK.playMusicConfig, this.playMusicConfig);
        cc.director.getScene().getChildByName('AppDelegate').getComponent('AppDelegate').backgroundMusic();
    },

    voiceToggleOnClick(target) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        this.playMusicConfig.effect = target.isChecked;
        Tools.setLocalData(Global.LSK.playMusicConfig, this.playMusicConfig);
        cc.director.getScene().getChildByName('AppDelegate').getComponent('AppDelegate').backgroundMusic();
    },

    /**
     * 关闭本窗口
     */
    closeOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Global.closeDialog(this.node);
        cc.log('removeSelf');
    },

    /**
     * 登出
     */
    logoutOnClick() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Tools.setLocalData(Global.LSK.secretKey, '');
        cc.director.loadScene('Login');
    },

});
