cc.Class({
    extends: cc.Component,

    properties: {

    },

    // use this for initialization
    onLoad() {

    },

    closeTrojanScanCallback() {
        this.node.destroy();
        cc.warn('closeCallback');
    },
});
