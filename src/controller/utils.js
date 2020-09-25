const xml2js = require('xml2js')
const { HttpError, WechatOpenToolkitError } = require('./error')

const HTTP_STATUS_CODE_OK = 200 // HTTP 状态码

const xmlParser = new xml2js.Parser({
    explicitRoot: false,
    explicitArray: false
})
const xmlBuilder = new xml2js.Builder({
    rootName: 'xml',
    headless: true,
    cdata: true
})

const parseXml = xmlParser.parseString.bind(xmlParser)
const buildObject = xmlBuilder.buildObject.bind(xmlBuilder)

// 校验响应的结果是否有问题
function validator(ret) {
    let { statusCode, data } = ret
    let { errcode, errmsg } = data

    if (statusCode === HTTP_STATUS_CODE_OK) {
        if (errcode) {
            throw new WechatOpenToolkitError(errmsg, errcode)
        } else {
            return data
        }
    } else {
        throw new HttpError('请求出错', statusCode)
    }
}

/**
 * 加密且发送给公众号用户
 * @param {String} rawData 
 */
function encodeAndSend(jsonFromUser, endFixJson) {
    //加密
    const encodingAESKey = think.config('WX').key
    let wechatEncrypt = new WechatEncrypt({ appId: think.config('WX').appid, encodingAESKey, token: think.config('WX').token })

    let jsonToUser = {
        ToUserName: `<![CDATA[${jsonFromUser.FromUserName}]]>`,
        FromUserName: `<![CDATA[${jsonFromUser.ToUserName}]]>`,
        CreateTime: parseInt(Number(new Date() / 1000)),
    }
    //混合
    Object.assign(jsonToUser, endFixJson)
    let builder = new xml2js.Builder({
        rootName: 'xml',
        cdata: false
    });

    let xml = builder.buildObject(jsonToUser) // js 对象转 xml 字符串
    xml = xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '') //替换转义
    xml = this.deleteXMLSpace(xml)

    let Encrypt = wechatEncrypt.encode(xml) // 加密内容
    let TimeStamp = Date.now() // 时间戳
    let Nonce = Math.random().toString(36).slice(2, 18) // 随机字符串
    let MsgSignature = wechatEncrypt.genSign({ timestamp: TimeStamp, nonce: Nonce, encrypt: Encrypt }) // 签名

    let xml2weixin = buildObject({ Encrypt, TimeStamp, Nonce, MsgSignature })
    this.body = xml2weixin
    this.saveWechatMsg(jsonFromUser, jsonToUser)
}


/**
 * 获取access token
 * @param {string} user_id 
 * @param {string} authorizer_appid 
 */
async function getAccessToken(user_id, authorizer_appid) {
    let condition = null
    if (user_id) {
        if (think.isTrueEmpty(user_id) || think.isTrueEmpty(authorizer_appid)) {
            return this.fail('用户或appid为空')
        }
        condition = {
            user_id,
            authorizer_appid,
        }
    } else {
        if (think.isTrueEmpty(authorizer_appid)) {
            return this.fail('appid为空')
        }
        condition = {
            authorizer_appid,
        }
    }

    let authorizationInfos = await this.model('service_wechat_authorization_infos').where(condition).field('authorizer_appid, authorizer_access_token').find()
    if (think.isEmpty(authorizationInfos)) {
        return this.fail('数据库里无此公众号')
    } else {
        return authorizationInfos
    }
}

module.exports = { parseXml, buildObject, validator, encodeAndSend, getAccessToken }