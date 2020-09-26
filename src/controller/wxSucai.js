const Base = require('./base.js')
const axios = require('axios')
const querystring = require('querystring');
const { getAccessToken } = require('./util')

/**
 * 微信开放平台 素材管理
 */
module.exports = class extends Base {
    constructor(ctx) {
        super(ctx)
    }

    /**
     * 获取永久素材
     */
    async getMetarialAction() {
        let { user_id, authorizer_appid } = this.post()

        if (think.isTrueEmpty(user_id) || think.isTrueEmpty(authorizer_appid)) {
            return this.fail('用户或appid为空')
        }

        let condition = {
            user_id,
            authorizer_appid,
        }

        let authorizationInfos = await this.model('service_wechat_authorization_infos').where(condition).field('authorizer_appid, authorizer_access_token').find()
        if (think.isEmpty(authorizationInfos)) {
            return this.fail('无此公众号')
        }

        let url = this.WECHATapi.prefix + this.WECHATapi.get_material
        let query = { access_token: authorizationInfos.authorizer_access_token }
        let body = { media_id: 'media_id' }
        url += '?' + querystring.stringify(query)

        let response = await axios.post(url, body)
        let backData = response.data

        //正确返回 {errcode:0}
        if (backData.errcode) {
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }


    /**
     * 获取临时素材
     * 
     * 正确情况下的返回HTTP头如下：
     * HTTP/1.1 200 OK
        Connection: close
        Content-Type: image/jpeg
        Content-disposition: attachment; filename="MEDIA_ID.jpg"
        Date: Sun, 06 Jan 2013 10:20:18 GMT
        Cache-Control: no-cache, must-revalidate
        Content-Length: 339721
        curl -G "https://api.weixin.qq.com/cgi-bin/media/get?access_token=ACCESS_TOKEN&media_id=MEDIA_ID"

        如果返回的是视频消息素材，则内容如下：
        {
          "video_url":DOWN_URL
        }

        错误情况下的返回JSON数据包示例如下（示例为无效媒体ID错误）：
        {"errcode":40007,"errmsg":"invalid media_id"}
    */
    async mediaGetAction() {
        const { user_id, authorizer_appid, media_id } = this.post()
        const accessToken = await getAccessToken(user_id, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').media_get
        let query = {
            access_token: accessToken.authorizer_access_token,
            authorizer_appid,
            media_id
        }
        url += '?' + querystring.stringify(query)

        let response = await axios.get(url)
        let backData = response.data

        if (backData.hasOwnProperty('errcode')) {
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }


    /**
     * 获取永久素材
     * 
     * * 正确返回:
       * { //图文
          "news_item":
          [
            {
            "title":TITLE,
            "thumb_media_id"::THUMB_MEDIA_ID,
            "show_cover_pic":SHOW_COVER_PIC(0/1),
            "author":AUTHOR,
            "digest":DIGEST,
            "content":CONTENT,
            "url":URL,
            "content_source_url":CONTENT_SOURCE_URL
            },
            //多图文消息有多篇文章
          ]
        }

        { //视频
          "title":TITLE,
          "description":DESCRIPTION,
          "down_url":DOWN_URL,
        }

        其他类型的素材消息，则响应的直接为素材的内容，开发者可以自行保存为文件

        错误情况下的返回JSON数据包示例如下（示例为无效媒体类型错误）：
      */
    async getMaterialAction() {
        const { user_id, authorizer_appid, media_id } = this.post()
        const accessToken = await getAccessToken(user_id, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').get_material
        let query = { access_token: accessToken.authorizer_access_token }
        url += '?' + querystring.stringify(query)
        let body = { media_id }

        let response = await axios.post(url, body)
        let backData = response.data

        // {"errcode":40007,"errmsg":"invalid media_id"}
        if (backData.hasOwnProperty('errcode')) {
            think.logger.error(new Error(JSON.stringify(backData)))
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }


    /**
     * 获取素材总数
     * * 正确返回:
         * {
                "voice_count": 1,
                "video_count": 1,
                "image_count": 204,
                "news_count": 1,
                "code": 0,
                "msg": ""
            }
          错误情况下的返回JSON数据包示例如下（示例为无效媒体类型错误）：
          {"errcode":-1,"errmsg":"system error"}
     */
    async getMaterialCountAction() {
        const { user_id, authorizer_appid } = this.post()
        const accessToken = await getAccessToken(user_id, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').get_materialcount
        let query = { access_token: accessToken.authorizer_access_token }
        url += '?' + querystring.stringify(query)

        let response = await axios.get(url)
        let backData = response.data

        if (backData.hasOwnProperty('errcode')) {
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }

    /**
     * 获取素材列表
     */
    async batchgetMaterialAction() {
        const { user_id, authorizer_appid, TYPE, OFFSET, COUNT } = this.post()
        const accessToken = await getAccessToken(user_id, authorizer_appid)

        if (!accessToken) {
            return this.fail('无法识别appid')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').batchget_material
        let query = { access_token: accessToken.authorizer_access_token }
        let body = {
            "type": TYPE, //素材的类型，图片（image）、视频（video）、语音 （voice）、图文（news）
            "offset": OFFSET,
            "count": COUNT
        }
        url += '?' + querystring.stringify(query)

        let response = await axios.post(url, body)
        let backData = response.data

        //正确返回数据，错误返回{"errcode":40007,"errmsg":"invalid media_id"}
        if (backData.hasOwnProperty('errcode')) {
            this.fail(backData)
        } else {
            this.success(backData)
        }
    }



    /**
     * TODO 新增临时素材
     */
    async mediaUploadAction() {}


    /**
     * TODO 新增永久图文素材
     */
    async materialAddNewsAction() {}


    /**
     * TODO 上传图文消息内的图片获取URL
     */
    async mediaUpoladimgAction() {}


    /**
     * TODO 新增其他类型永久素材
     */
    async addMaterialAction() {}



    /**
     * TODO 删除永久素材
     */
    async delMaterialAction() {}


    /**
     * TODO 修改永久图文素材
     */
    async mertrialUpdateNewsAction() {}


}