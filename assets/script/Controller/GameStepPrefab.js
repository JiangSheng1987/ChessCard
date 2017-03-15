cc.Class({
    extends: cc.Component,

    properties: {
        gameStepData: [],

        gameStepCell: cc.Prefab,
        gameStepList: cc.Node,

        datetime: cc.Label,

        username1: cc.Label,
        username2: cc.Label,
        username3: cc.Label,
        username4: cc.Label,
    },

    // use this for initialization
    onLoad: function () {

    },

    seeOtherRoomOnClick: function() {
        Global.playEffect(Global.audioUrl.effect.buttonClick);

    },

    /**
     * 关闭本窗口
     */
    closeOnClick: function(event, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);
        Global.closeDialog(this.node);
    },

    shareOnClick: function(evt, data) {
        Global.playEffect(Global.audioUrl.effect.buttonClick);

    },

    setData: function(data) {
        this.roomId = data;
        this._getHttpRecordInfoData();
    },

    _getHttpRecordInfoData: function() {
        Global.dialog.open('Loading', this.node);

        let self = this;
        HttpRequestManager.httpRequest("recordInfo", {}, function(event, result) {
            if (result.code == 1) {
                self.datetime.string = result.datetime;
                let recordInfoDataList = result.recordInfoDataList;
                if (recordInfoDataList.length !== 0) {
                    self.gameRecordList.removeAllChildren();
                    for (let i = 0; i < recordInfoDataList.length; i += 1) {
                        let cell = cc.instantiate(this.gameStepCell);
                        cell.getComponent('GameStepCellPrefab').setData(recordInfoDataList[i], this.roomId);
                        self.gameStepList.addChild(cell);
                    }

                }
            }
            else {

            }
            Global.dialog.close();
        });
    }
});
