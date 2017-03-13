cc.Class({
    extends: cc.Component,

    properties: {
        avatar: cc.Sprite,
        nickname: cc.Label,
        money: cc.Label,
        notice: cc.Node,
        userInfoPrefab: cc.Prefab,
        payOptionsPrefab: cc.Prefab,
        gameRecordPrefab: cc.Prefab,
        soundPrefab: cc.Prefab,
        gameRulesPrefab: cc.Prefab,
        createRoomPrefab: cc.Prefab,
        inputRoomNumberPrefab: cc.Prefab,
        myRoomPrefab: cc.Prefab,
    },

    // use this for initialization
    onLoad() {
        // this.node.setLocalZOrder(-1);
        // cc.game.addPersistRootNode(this.node);

        const userInfo = Tools.getLocalData(Global.LSK.userInfo);
        if (userInfo) {
            Tools.setWebImage(this.avatar, userInfo.headimgurl);
            this.nickname.string = userInfo.nickname;
            this.money.string = userInfo.gold;
            this.notice.getComponent(cc.Label).string = userInfo.notice;
            // Animation.openScrollWordAction(this.notice, userInfo.notice.length * 0.5);
            Animation.openScrollWordAction(this.notice, 50);
        }
    },

    /**
     * 查看用户信息
     */
    openUserInfoPanelOnClick() {
        Global.tempCache = Tools.getLocalData(Global.LSK.userInfo);
        Global.openDialog(cc.instantiate(this.userInfoPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 绑定上级代理
     * 如果绑定上级代理, 则为充值
     */
    openPayPanelOnClick() {
        Global.openDialog(cc.instantiate(this.payOptionsPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 游戏记录
     */
    openGameRecordPanelOnClick() {
        // var gameRecordPrefab = this.gameRecordPrefab.getComponent('GameRecordPrefab');
        // gameRecordPrefab.init();
        Global.openDialog(cc.instantiate(this.gameRecordPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 声音选项
     */
    openSoundPanelOnClick() {
        Global.openDialog(cc.instantiate(this.soundPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 登出
     */
    logoutOnClick() {
        Tools.setLocalData(Global.LSK.secretKey, '');
        cc.director.loadScene('Login');
    },

    /**
     * 游戏规则
     */
    openGameRulesPanelOnClick() {
        Global.openDialog(cc.instantiate(this.gameRulesPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 创建游戏房间
     */
    openCreateRoomPanelOnClick() {
        Global.openDialog(cc.instantiate(this.createRoomPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 加入游戏房间
     */
    openAddGamePanelOnClick() {
        const node = cc.instantiate(this.inputRoomNumberPrefab);
        node.getComponent('InputRoomNumberPrefab').setData('GameRoom');
        Global.openDialog(node, this.node, () => {
            cc.warn('load success');
        });
    },

    /**
     * 我的游戏房间
     */
    openMyRoomPanelOnClick() {
        // cc.director.loadScene('MyRoom');
        Global.openDialog(cc.instantiate(this.myRoomPrefab), this.node, () => {
            cc.warn('load success');
        });
    },

});
