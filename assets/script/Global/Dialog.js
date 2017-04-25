var Dialog = cc.Class({
    extends: cc.Component,

    properties: {
        loadingPrefab: cc.Prefab,
        messagePrefab: cc.Prefab,
        popuNode: cc.Node,
    },

    openLoading: function() {
        this.popuNode = cc.instantiate(this.loadingPrefab);
        var node = cc.director.getScene().getChildByName('Canvas');
        node.addChild(this.popuNode);

        cc.director.getScheduler().schedule(this.close.bind(this), this, 20, false);
    },

    openMessageBox: function(message, callback) {
        callback = callback || function () {};

        this.popuNode = cc.instantiate(this.messagePrefab);
        this.popuNode.getComponent('MessageBox').addMessage(message, callback);
        var node = cc.director.getScene().getChildByName('Canvas');
        node.addChild(this.popuNode);
    },

    close: function() {
        cc.log('Dialog.close');
        this.popuNode.destroy();
        cc.director.getScheduler().unschedule(this.close.bind(this), this);
    }
});

module.exports = Dialog;