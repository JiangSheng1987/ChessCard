module.exports = {
    /**
     * 接口名协议
     * @type {Object}
     */
    requestProtocol: {
        check: {
            api: "client/check",
            description: "login", 
            protocol: "CheckVersion",
        },
        login: {
            api: "client/login",
            description: "login", 
            protocol: "Login",
        },
        playerGold: {
            api: "login/balance",
            description: "login", 
            protocol: "PlayerGold",
        },
    },

    getCheckVersionRequestMessage: function(parameters) {
        var message = new proto.login.CheckVersionRequest();
        message.setAppUuid(PX258.appUuid);
        message.setVerNo(PX258.version);
        message.setAndroidOrIos(PX258.os);

        return message;
    },

    getLoginRequestMessage: function(parameters) {
        var message = new proto.login.LoginRequest();
        message.setWxCode(parameters.wxCode);
        message.setAppUuid(PX258.appUuid);
        message.setDeviceId(PX258.getDeviceId());
        message.setVerNo(PX258.version);
        message.setLocation(parameters.location);
        
        cc.log([parameters.wxCode, PX258.appUuid, PX258.getDeviceId(), PX258.version, parameters.location]);
        return message;
    },

    getPlayerGoldRequestMessage: function(parameters) {
        var message = new proto.login.PlayerGoldRequest();
        
        message.setPlayerUuid(parameters.playerUuid);
        message.setAppUuid(PX258.appUuid);
        message.setDeviceId(PX258.getDeviceId());
        
        cc.log([parameters.playerUuid, PX258.appUuid, PX258.getDeviceId()]);
        return message;
    },

    httpRequest: function(protocolName, message, callback) {
        var protocol = this.requestProtocol[protocolName];
        var request = cc.loader.getXMLHttpRequest();
        request.open("POST", (PX258.debug ? PX258.apiAddress.development : PX258.production) + protocol.api);
        request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        request.send(message.serializeBinary());
        request.onload = function(event) {
            var result = goog.crypt.base64.decodeStringToUint8Array(request.responseText);
            var result = proto[protocol.description][protocol.protocol + "Response"].deserializeBinary(result);
            
            callback(event, result);
            cc.log("HttpRequestManager.httpRequest " + protocolName + " , code: "  + result.getCode());
        };
    }
}