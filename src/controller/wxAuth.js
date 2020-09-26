const Base = require('./base.js')
const aes = require('wx-ding-aes')
const xml2js = require('xml2js')
const parseString = xml2js.parseString
const moment = require('moment')
const axios = require('axios')
const querystring = require('querystring');

/**
 * 微信开放平台 授权相关
 */
module.exports = class extends Base {
    constructor(ctx) {
        super(ctx)
    }

    /**
     * 获取微信开放平台的验证票据的接口
     * 微信那边每10分钟推送1次，但有效期比token更长
     */
    async ticketAction() {
        //微信带密文的请求
        let wx_backdata = this.post()
        this.body = 'success' //立即响应微信success

        //判断微信密文异常否
        if (think.isEmpty(wx_backdata)) {
            console.log('component ticket failure')
        } else {
            wx_backdata = wx_backdata.xml.Encrypt[0]

            //解密微信传递给回调接口的密文
            const encodingAESKey = think.config('WX').key
            const xml = aes.decode(wx_backdata, encodingAESKey)

            //解析xml
            parseString(xml, async (err, ret) => {
                // 推送的是 票据component ticket
                if (ret.xml.InfoType[0] === 'component_verify_ticket') {
                    let ticket = ret.xml.ComponentVerifyTicket[0] // 明文票据ticket
                    /**
                     * 存储到缓存
                     * 更好的方式是存储到redis
                     * 因为微信每10分钟会推送一次，但会有2小时的有效期，所以要过滤掉重复的推送，让缓存里始终是最新的票据
                     */
                    if (!think.isEmpty(ticket)) {
                        //判断是否存在
                        let cacheTicket = await this.cache('Ticket')
                        //不存在
                        if (think.isEmpty(cacheTicket)) {
                            console.log(moment().format('HH:mm:ss'), '无验证票据')
                        }
                        //存在但有更新的
                        else if (cacheTicket != ticket) {
                            console.log(moment().format('HH:mm:ss'), '有新的验证票据')
                        }
                        //存在且一致
                        else {
                            return console.log(moment().format('HH:mm:ss'), '验证票据存在且一致')
                        }

                        //清空且写入
                        await this.cache('Ticket', null)
                        await this.cache('Ticket', ticket)
                    }
                }
                // 推送的是 授权相关 (授权成功 解除授权 授权变更)
                else {
                    let jsonFromWeixin = ret.xml
                    this.handlerInfoType(jsonFromWeixin)
                }
            })
        }
    }

    /**
     * 处理与授权相关的函数
     * @param {Object} jsonFromWeixin 
     */
    async handlerInfoType(jsonFromWeixin) {
        //1. 微信系统产生的消息 (授权、取消授权、更新授权)
        let infotype = jsonFromWeixin.InfoType[0]
        switch (infotype) {
            case 'authorized': //授权成功通知
                console.log('授权成功通知')
                this.saveWechatMsg2(jsonFromWeixin) //存储但不往下执行
                //TODO 授权成功操作
                break;
            case 'unauthorized': //取消授权通知
                console.log('取消授权通知')
                //删除数据库里此公众号所有的信息...
                break;
            case 'updateauthorized': //授权更新通知
                console.log('授权更新通知')
                this.saveWechatMsg2(jsonFromWeixin) //存储但不往下执行
                //TODO 授权更新操作
                break;
        }

    }

    /**
     * 获取开放平台的令牌
     * 定时任务，确保始终可用状态
     * 每1小时50分/6600秒调用一次，有效时间2小时
     */
    async updateComponentAccessTokenAction() {
        // 是否定时任务 否拒绝
        if (!this.isCli) {
            return this.fail(1000, 'deny')
        }

        let cacheTicket = await this.cache('Ticket')
        //是否存在验证票据
        if (this.isNull(cacheTicket)) {
            return console.log('无验证票据')
        }

        let now = moment().format('YYYY-MM-DD HH:mm:ss')
        let cacheToken = await this.cache('Token')
        let [duration, expiresTime] = [-1, -1]
        if (!think.isEmpty(cacheToken)) {
            duration = moment(now).diff(moment(cacheToken.created), 'seconds')
            expiresTime = cacheToken.expires - 1800
        }

        /**
         * 1 存在token且未过期 不操作
         * 2 存在token且已过期 更新
         * 3 不存在token 写入
         */

        //1
        if (!think.isEmpty(cacheToken) && duration < expiresTime) {
            console.log('开放平台令牌未过期，剩余秒数：', expiresTime - duration)
            return
        }
        //2
        else if (!think.isEmpty(cacheToken) && duration > expiresTime) {
            console.log('开放平台令牌已过期')
        }
        //3
        else {
            console.log('不存在开放平台令牌')
        }

        //清空且写入
        await this.cache('Token', null)

        let wx_token_url = think.config('WECHATapi').prefix + think.config('WECHATapi').componentToken
        const body = {
            "component_appid": think.config('WX').appid,
            "component_appsecret": think.config('WX').appsecret,
            "component_verify_ticket": cacheTicket
        }

        try {
            const response = await axios.post(wx_token_url, body)

            //插入时间
            let json = {
                token: response.data.component_access_token,
                expires: response.data.expires_in,
                created: moment().format('YYYY-MM-DD HH:mm:ss'),
                component_appid: think.config('WX').appid
            }
            await this.cache('Token', json)

        } catch (error) {
            console.error('get token error: ', error)
        }
    }

    /**
     * 获取开放平台的预授权码（间隔时间：10分钟，有效期10分钟）
     * 一公众号一码原则：用户每次点击授权，就得重新获取预授权码，预授权码可以无限次获取
     * 注意：一用户可能关联多个公众号
     * 给前端返回pre_auth_code
     */
    async getUserClickAuthAction() {
        let user_id = this.post('user_id')
        if (this.isNull(user_id)) {
            return this.fail('没有用户id')
        }

        //是否存在token
        let cacheToken = await this.cache('Token')
        if (think.isEmpty(cacheToken)) {
            return console.log(moment().format('HH:mm:ss'), '无开放平台令牌 pac')
        }

        let wx_preauthcode_url = think.config('WECHATapi').prefix + think.config('WECHATapi').createPreauthcode
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        const body = { "component_appid": think.config('WX').appid }

        try {
            const response = await axios.post(wx_preauthcode_url, body)
            const pre_auth_code = response.data.pre_auth_code

            if (this.isNull(pre_auth_code)) {
                throw new Error('获取开放平台预授权码出错')
            }

            this.success({ data: pre_auth_code })
        } catch (error) {
            console.error(error)
        }
    }

    /**
     * 获取微信授权后回调页面URI的数据的接口
     * 获取用户公众号的授权码 auth_code (有效期10分钟)
     * redirect_url?auth_code=xxx&expires_in=600
     */
    async backauthorizeAction() {
        let wx_backdata = this.get()
        if (think.isEmpty(wx_backdata)) {
            throw new Error('wx get authcodeinfo failure')
        }

        let user_id = wx_backdata.user_id
        let auth_code = wx_backdata.auth_code

        if (this.isNull(auth_code)) {
            throw new Error('获取授权码出错')
        }
        //立即向微信返回 success
        this.body = 'success'

        // 立即去获取授权的TOKEN信息
        await this.getWechatAuthorizationInfosAction(user_id, auth_code)
    }


    /**
     * 使用授权码获取扫码公众号的ACCESS TOKEN信息 保存入库
     * @param {string} user_id 
     * @param {string} auth_code 
     */
    async getWechatAuthorizationInfosAction(user_id, auth_code) {
        let cacheToken = await this.cache('Token')
        //是否存在token
        if (this.isNull(cacheToken)) {
            console.log(moment().format('HH:mm:ss'), '无令牌，无法获取此用户的公众号信息')
            return
        }

        let json = {},
            now = null

        let wx_authinfo_url = think.config('WECHATapi').prefix + think.config('WECHATapi').queryAuth
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        const body = {
            "component_appid": think.config('WX').appid,
            "authorization_code": auth_code
        }

        try {
            const response = await axios.post(wx_authinfo_url, body)
            let authInfo = response.data.authorization_info

            let condition = { authorizer_appid: authInfo.authorizer_appid }
            const num = await this.model('service_wechat_authorization_infos').where(condition).delete()

            now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
            //组装要入库的json
            json = {
                user_id: user_id,
                authorizer_appid: authInfo.authorizer_appid, //唯一
                authorizer_access_token: authInfo.authorizer_access_token, //有效时长 2小时
                expires_in: authInfo.expires_in,
                authorizer_refresh_token: authInfo.authorizer_refresh_token,
                func_info: JSON.stringify(authInfo.func_info),
                created_at: now,
                update_at: now,
            }

            //入库
            const flag = await this.model('service_wechat_authorization_infos').add(json)
            if (flag) console.log('添加用户授权TOKEN成功 公众号授权码')
            else return Promise.reject('添加用户授权TOKEN信息失败，请重新授权 公众号授权码')

            //获取到用户授权信息后 立即去获取用户的公众号基本信息并入库
            //第一次才此操作，以后用定时任务来更新公众号基本信息
            await this.getWechatAuthorizerInfosAction(user_id, authInfo.authorizer_appid)
        } catch (error) {
            console.error('获取扫码公众号的ACCESS TOKEN信息', error)
        }
    }

    /**
     * 全网发布测试
     * 第三方平台方拿到 $query_auth_code$ 的值后，通过接口文档页中的使用授权码获取授权信息接口
     * 将 $query_auth_code$ 的值赋值给接口所需的参数 authorization_code
     * @param {string} auth_code 
     */
    async getWechatAuthorizationInfos2Action(auth_code) {
        let cacheToken = await this.cache('Token')
        //是否存在token
        if (this.isNull(cacheToken)) {
            throw new Error('无令牌，无法获取此用户的公众号信息')
        }

        let wx_authinfo_url = think.config('WECHATapi').prefix + think.config('WECHATapi').queryAuth
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        const body = {
            "component_appid": think.config('WX').appid,
            "authorization_code": auth_code
        }

        try {
            const response = await axios.post(wx_authinfo_url, body)
            return response.data
        } catch (error) {
            console.error('全网发布测试 获取扫码公众号的ACCESS TOKEN信息', error)
        }
    }

    /**
     * 定时刷新authorizer_access_token
     * 每2小时，确保始终保持可用状态
     * 定时从数据库里查询所有用户的认证信息，对比时间，若有快到期的，就去微信重新获取
     * 注意 刷新令牌只有重新授权才会更新
     */
    async updateAuthAccessTokenAction() {
        // 是否定时任务 否拒绝
        if (!this.isCli) {
            this.fail('非定时任务调用')
            throw new Error('非定时任务调用')
        }

        //是否存在token
        let cacheToken = await this.cache('Token')
        if (this.isNull(cacheToken)) {
            throw new Error('认证表无令牌')
        }

        const model = await this.model('service_wechat_authorization_infos')
        const users = await model.select()

        //是否空数组
        if (think.isEmpty(users)) {
            throw new Error('获取认证表为空')
        }

        for (let i = 0; i < users.length; i++) {
            let now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')

            let e = users[i]
            let [duration, expiresTime] = [-1, -1]
            duration = moment(now).diff(moment(e.update_at), 'seconds')
            expiresTime = e.expires_in - 1800

            //authorizer_access_token未过期 不操作
            if (duration < expiresTime) {
                console.log('authorizer_access_token未过期，剩余秒数：', expiresTime - duration, e.authorizer_appid)
                continue
            }

            let url = think.config('WECHATapi').prefix + think.config('WECHATapi').authorizerToken
            let query = { component_access_token: cacheToken.token }
            url += '?' + querystring.stringify(query)
            const body = {
                "component_appid": think.config('WX').appid,
                "authorizer_appid": e.authorizer_appid,
                "authorizer_refresh_token": e.authorizer_refresh_token,
            }

            try {
                const response = await axios.post(url, body)

                if (response.data.hasOwnProperty('errcode')) {
                    think.logger.error(new Error(JSON.stringify(response.data)))
                    continue;
                }

                const condition = {
                    user_id: e.user_id,
                    authorizer_appid: e.authorizer_appid
                }
                const json = {
                    authorizer_access_token: response.data.authorizer_access_token,
                    expires_in: response.data.expires_in,
                    authorizer_refresh_token: response.data.authorizer_refresh_token,
                    update_at: now,
                }
                const num = await model.where(condition).update(json)

                if (num > 0) {
                    this.success('更新authorizer_access_token成功', response.data.authorizer_access_token)
                } else {
                    this.fail('更新authorizer_access_token失败')
                }
            } catch (error) {
                console.error('get 公众号令牌 cron err=', error)
            }
        }
    }

    /**
     * 获取用户公众号基本信息
     * TODO 授权变更通知推送 添加逻辑处理 (程序被动刷新)
     * TODO 若公众号重新认证或对信息做了更改， 同步信息 （用户主动刷新）
     * @param {string} user_id 
     * @param {string} authorizer_appid 
     */
    async getWechatAuthorizerInfosAction(user_id, authorizer_appid) {
        let cacheToken = await this.cache('Token')
        //是否存在token
        if (this.isNull(cacheToken)) {
            throw new Error('无令牌，无法获取此用户的公众号信息')
        }

        let json = {},
            now = null
        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').getAuthorizerOption
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        const body = {
            "component_appid": think.config('WX').appid,
            "authorizer_appid": authorizer_appid,
        }

        try {
            const response = await axios.post(url, body)
            let info = response.data

            const num = await this.model('service_wechat_authorizer_infos').where({ authorizer_appid }).delete()
            now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')

            json = {
                'user_id': user_id,
                'authorizer_appid': authorizer_appid, //唯一
                'user_name': info.authorizer_info.user_name,
                'nick_name': info.authorizer_info.nick_name,
                'principal_name': info.authorizer_info.principal_name,
                'head_img': info.authorizer_info.head_img,
                'service_type_info': JSON.stringify(info.authorizer_info.service_type_info),
                'verify_type_info': JSON.stringify(info.authorizer_info.verify_type_info),
                'business_info': JSON.stringify(info.authorizer_info.business_info),
                'alias': info.authorizer_info.alias,
                'qrcode_url': info.authorizer_info.qrcode_url,
                // 'user_sync' : 0 , 默认值
                'created_at': now,
                'updated_at': now,
            }

            //入库
            const flag = await this.model('service_wechat_authorizer_infos').add(json)
            if (flag) console.log('添加成功 基本信息')
            else return Promise.reject('添加失败 基本信息')
        } catch (error) {
            console.error('公众号appid重复 基本信息', error)
            // 状态同步
            if (error.errno == 1062) {
                const conditions = {
                    user_id: user_id,
                    authorizer_appid: json.authorizer_appid,
                }

                const feilds = {
                    'user_name': json.user_name,
                    'nick_name': json.nick_name,
                    'principal_name': json.principal_name,
                    'head_img': json.head_img,
                    'service_type_info': JSON.stringify(json.service_type_info),
                    'verify_type_info': JSON.stringify(json.verify_type_info),
                    'business_info': JSON.stringify(json.business_info),
                    'alias': json.alias,
                    'qrcode_url': json.qrcode_url,
                    'user_sync': 2, // 同步成功
                    'updated_at': now,
                }

                const num = await this.model('service_wechat_authorizer_infos').where(conditions).update(feilds)
                if (num > 0) {
                    this.success('更新成功')
                } else {
                    let fileds = {
                        user_sync: 3, //同步失败
                        'updated_at': now,
                    }
                    await this.model('service_wechat_authorizer_infos').where({ user_id: user_id }).update(fileds)
                    this.fail('更新失败')
                }
            }
        }
    }


    /**
     * 给前端返回 用户公众号基本信息
     */
    async showAuthorizerInfosAction() {
        let { user_id, authorizer_appid } = this.post()
        if (think.isTrueEmpty(user_id) || think.isTrueEmpty(authorizer_appid)) {
            return this.fail('用户或appid为空')
        }

        let condition = {
            user_id,
            authorizer_appid,
        }

        let infos = await this.model('service_wechat_authorizer_infos').where(condition).find()
        if (think.isEmpty(infos)) {
            this.fail('无此公众号, 获取失败')
        } else {
            this.success(infos)
        }
    }


    /**
     * 拉取所有已授权的帐号信息
     */
    async getAuthorizerListFromWXAction() {
        let cacheToken = await this.cache('Token')
        if (this.isNull(cacheToken)) {
            throw new Error('无令牌，无法获取此用户的公众号信息')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').getAuthorizerList
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        let body = {
            "component_appid": think.config('WX').appid,
            "offset": 0,
            "count": 100
        }
        try {
            let response = await axios.post(url, body)
            let backData = response.data

            if (think.isEmpty(backData)) {
                this.fail('公众平台暂无已授权公众号', backData)
            } else {
                this.success(backData)
            }
        } catch (err) {
            console.log(err)
        }
    }

    /**
     * 拉取所有已授权的帐号信息
     */
    async getAuthorizerListAction() {
        const { user_id } = this.post()
        if (think.isTrueEmpty(user_id)) {
            return this.fail('用户为空')
        }

        //只返回本B端用户名下的公众号
        let authorizers = await this.model('service_wechat_authorizer_infos').where({ user_id }).select()
        if (think.isEmpty(authorizers)) {
            this.fail('此用户无授权公众号')
        } else {
            this.success(authorizers)
        }

    }

    /**
     * 获取授权方选项信息
     */
    async getAuthorizerOptionAction() {
        const { authorizer_appid, option_name } = this.post()

        //是否存在token
        let cacheToken = await this.cache('Token')
        if (this.isNull(cacheToken)) {
            throw new Error('无令牌，无法获取此用户的公众号信息')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').getAuthorizerOption
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        let body = {
            "component_appid": think.config('WX').appid,
            authorizer_appid,
            option_name
        }

        try {
            let response = await axios.post(url, body)
            let backData = response.data
            this.body = backData
        } catch (err) {
            console.log(err)
        }
    }

    /**
     * 设置授权方选项信息
     */
    async setAuthorizerOptionAction() {
        const { authorizer_appid, option_name, option_value } = this.post()

        //是否存在token
        let cacheToken = await this.cache('Token')
        if (this.isNull(cacheToken)) {
            throw new Error('无令牌，无法获取此用户的公众号信息')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').setAuthorizerOption
        let query = { component_access_token: cacheToken.token }
        url += '?' + querystring.stringify(query)
        let body = {
            "component_appid": think.config('WX').appid,
            authorizer_appid,
            option_name,
            option_value
        }

        try {
            let response = await axios.post(url, body)
            let backData = response.data
            this.body = backData
        } catch (err) {
            console.log(err)
        }
    }


    /**
     * 第三方平台全网发布,消息与事件接收URL
     * @Author: flytiger
     */
    async appidAction() {
        // this.body='' //第三方平台方需在 5 秒内返回空串表明暂时不回复
        //微信带密文的请求
        let wx_backdata = this.post()
        let url = this.ctx.url
        const reg = /wx[0-9a-z]{16}/
        url = reg.exec(url)
        let authorizer_appid = url.length > 0 ? url[0] : ''

        //是否微信postdata异常
        if (!wx_backdata.hasOwnProperty('xml')) {
            throw new Error('微信postdata异常')
        }
        let wx_backdata2 = wx_backdata.xml.Encrypt[0]

        //解密微信传递给回调接口的密文
        const encodingAESKey = think.config('WX').key
        const xml = aes.decode(wx_backdata2, encodingAESKey)

        //解析xml->json
        parseString(xml, (err, ret) => {
            if (err) console.error('解析xml错误')
            this.handlerMsgtype(authorizer_appid, ret.xml)
        })
    }


        /**
     * 消息去重
     * 将普通消息的MsgId 或事件消息的FromUserName + CreateTime 存入缓存作为凭据
     * 新获取的消息和缓存里的凭据对比
     * TODO，数据量大了，要存入中控redis服务器
     * return 重复true
     */
    async isRepeatMsg(json) {
        let cacheMsg = null,
            flag = true

        let key = json.hasOwnProperty('MsgId') ? json.MsgId[0] + '' : json.FromUserName[0] + '' + json.CreateTime[0]
        cacheMsg = await this.cache(key) //缓存的key值为变量
        console.log('cacheMsg', cacheMsg)
        if (cacheMsg) { //重复 不操作
            return this.body = 'success'
        }
        await this.cache(key, 1, { timeout: 15 * 1000 }) //设置缓存超时时间
        cacheMsg = await this.cache(key)
    }

    /**
     * 去除xml中的空格 换行 TAB
     * @param {string} xml 
     */
    deleteXMLSpace(xml) {
        let sb = { str: "", toString: function() { return this.str; } }; {
            let arr = xml.split("\n");
            let _loop_1 = function(idx) {
                let s = arr[idx]; {
                    (function(sb) { sb.str = sb.str.concat(s.trim()); return sb; })(sb);
                }
            };
            for (let idx = 0; idx < arr.length; idx++) {
                _loop_1(idx);
            }
        }
        return sb.str;
    }
}