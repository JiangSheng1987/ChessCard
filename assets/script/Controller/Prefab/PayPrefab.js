cc.Class({
    extends: cc.Component,

    properties: {
        shopStore: cc.Prefab,
    },

    // use this for initialization
    onLoad: function () {

    },

    /**
     * 关闭本窗口
     */
    closeOnClick: function(event, data) {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        window.Global.Animation.closeDialog(this.node);
    },

    payOnClick: function(evt, data) {
        window.Global.SoundEffect.playEffect(window.Global.Config.audioUrl.effect.buttonClick);
        window.Global.Animation.openDialog(cc.instantiate(this.shopStore), this.node, function () {
            cc.log("load success");
        });
    }
});
