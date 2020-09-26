const Base = require('./base.js')
const axios = require('axios')
const querystring = require('querystring');
const { getAccessToken } = require('./util')

/**
 * 微信开放平台 客服
 */
module.exports = class extends Base {
    constructor(ctx) {
        super(ctx)
    }

    /**
     * 客服接口-发消息
     
    async sendMsgKfAction() {
        const { authorizer_appid } = this.post()
        const accessToken = await getAccessToken(false, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').sendMsgKf
        let query = { access_token: accessToken.authorizer_access_token }
        let body = {
            "touser": "abcdefgxxxxxxxxxxxxxx",
            "msgtype": "text",
            "text": {
                "content": "Hello World"
            }
        }

        url += '?' + querystring.stringify(query)

        let response = await axios.post(url, body)
        let backData = response.data

        if (think.isEmpty(backData)) {
            return this.fail('客服消息出错', backData)
        } else {
            this.body = backData
        }
    }
    */

    //客服接口-发消息
    async sendMsgKf(access_token, body) {
        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').sendMsgKf
        let query = { access_token }

        url += '?' + querystring.stringify(query)

        let response = await axios.post(url, body)
        let backData = response.data

        if (think.isEmpty(backData)) {
            return this.fail('客服消息出错', backData)
        } else {
            this.body = backData
        }
    }



}