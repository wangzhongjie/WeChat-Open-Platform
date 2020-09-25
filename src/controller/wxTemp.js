const Base = require('./base.js')
const axios = require('axios')
const querystring = require('querystring');
const { getAccessToken } = require('./util')

/**
 * 微信开放平台 模板
 */
module.exports = class extends Base {
    constructor(ctx) {
        super(ctx)
    }
   

    /**
     * 获取模板列表
     */
    async getAllPrivateTemplateAction() {
        const { user_id, authorizer_appid } = this.post()
        const accessToken = await getAccessToken(user_id, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').getAllPrivateTemplate
        let query = { access_token: accessToken.authorizer_access_token }
        url += '?' + querystring.stringify(query)

        let response = await axios.get(url)
        let backData = response.data

        //正确返回数据
        if (backData.hasOwnProperty('errcode')) {
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }

    //获得模板ID
    async getAddTemplateAction() {
        const { user_id, authorizer_appid, template_id_short } = this.post()
        const accessToken = await getAccessToken(user_id, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').addTemplate
        let query = { access_token: accessToken.authorizer_access_token }
        let body = { template_id_short }
        url += '?' + querystring.stringify(query)

        let response = await axios.post(url, body)
        let backData = response.data

        //正确返回数据
        if (backData.hasOwnProperty('errcode')) {
            think.logger.error(new Error(JSON.stringify(backData)))
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }




}