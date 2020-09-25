const Base = require('./base.js')
const aes = require('wx-ding-aes')
const xml2js = require('xml2js')
const parseString = xml2js.parseString
const moment = require('moment')
const axios = require('axios')
const _ = require('loadsh')
const querystring = require('querystring');
const { encodeAndSend } = require('./util')
let menuToUserMsgs = null

/**
 * 微信开放平台 自定义菜单
 */
module.exports = class extends Base {
    constructor(ctx) {
        super(ctx)
    }
    __before() {
        return Promise.resolve(super.__before()).then(async () => {
            menuToUserMsgs = await this.model('service_wechat_authorization_infos').field('authorizer_appid, menu_click').select()
        })
    }


    /**
     * 创建微信自定义菜单
     * 如果此用户有多个公众号，默认选第一个 返回limit
     */
    async createWeixinSelfMenuAction() {
        //拿到的数据，必须是压缩后的无空格无换行的JSON
        let { user_id, authorizer_appid, data } = this.post()
        if (think.isTrueEmpty(user_id) || think.isTrueEmpty(authorizer_appid) || think.isEmpty(data)) {
            return this.fail('用户或appid或data为空')
        }

        //处理click菜单的回复内容
        if (typeof data === 'string') {
            data = data.replace(/\n/g, "").replace(/\r/g, "").replace(/\s/g, "") //转义
            data = JSON.parse(data)
        }

        let toWeixinNeedData = _.cloneDeep(data)
        let reply4click = [],
            isNullCon = 0

        data.button.forEach(e => {
            //有二级菜单
            if (e.hasOwnProperty('sub_button')) {
                e.sub_button.forEach(f => {
                    if (f.type === 'click') {
                        let json = null

                        if (!f.hasOwnProperty('content') || think.isEmpty(f.content)) {
                            isNullCon = 1
                            throw new Error('发送消息按钮不能为空')
                        }
                        //文本
                        if (f.mode === 'text') {
                            json = { key: f.key, mode: 'text', content: f.content }
                        }
                        //视频
                        else if (f.mode === 'video') {
                            json = { key: f.key, mode: 'video', media_id: f.content.media_id, title: f.content.newcat, description: f.content.description }
                        }
                        //图片
                        else if (f.mode === 'image') {
                            json = { key: f.key, mode: 'image', media_id: f.content.media_id }
                        }
                        //语音
                        else if (f.mode === 'voice') {
                            json = { key: f.key, mode: 'voice', media_id: f.content.media_id }
                        }
                        //图文
                        else if (f.mode === 'news') {
                            let list = []
                            f.content.list.forEach(k => {
                                list.push({
                                    midea_id: k.midea_id,
                                    title: k.title,
                                    description: k.digest,
                                    picurl: k.thumb_media_id,
                                    url: k.url,
                                })
                            })
                            json = { key: f.key, mode: 'news', content: { list } }
                        }

                        reply4click.push(json)
                    }
                })
            }
            //只有一级菜单且有触发内容
            else {
                if (e.type === 'click') {
                    let json = null
                    if (!e.hasOwnProperty('content') || think.isEmpty(e.content)) {
                        isNullCon = 1
                        throw new Error('发送消息按钮不能为空')
                    }
                    //文本
                    if (e.mode === 'text') {
                        json = { key: e.key, mode: 'text', content: e.content }
                    }
                    //视频
                    else if (e.mode === 'video') {
                        json = { key: e.key, mode: 'video', media_id: e.content.media_id, title: e.content.newcat, description: e.content.description }
                    }
                    //图片
                    else if (e.mode === 'image') {
                        json = { key: e.key, mode: 'image', media_id: e.content.media_id }
                    }
                    //语音
                    else if (e.mode === 'voice') {
                        json = { key: e.key, mode: 'voice', media_id: e.content.media_id }
                    }
                    //图文
                    else if (e.mode === 'news') {
                        let list = []
                        e.content.list.forEach(k => {
                            list.push({
                                midea_id: k.midea_id,
                                title: k.title,
                                description: k.digest,
                                picurl: k.thumb_media_id,
                                url: k.url,
                            })
                        })
                        json = { key: e.key, mode: 'news', content: { list } }
                    }

                    //保存被动回复内容
                    reply4click.push(json)
                }
            }

        })

        if (isNullCon) {
            return this.fail('发送消息按钮不能为空')
        }

        toWeixinNeedData.button.forEach(e => {
            //有二级菜单
            if (e.hasOwnProperty('sub_button')) {
                e.sub_button.forEach(f => {
                    if (f.type === 'click') {
                        delete f.mode
                        delete f.content
                    }
                })
            }
            // 只有一级菜单 且有触发内容
            else {
                if (e.type === 'click') {
                    delete e.mode
                    delete e.content
                }
            }
        });

        let condition = {
            user_id,
            authorizer_appid,
        }

        let authorizationInfos = await this.model('service_wechat_authorization_infos').where(condition).field('authorizer_appid, authorizer_access_token').find()

        if (think.isEmpty(authorizationInfos)) {
            throw new Error('无此公众号')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').create
        let query = { access_token: authorizationInfos.authorizer_access_token }
        url += '?' + querystring.stringify(query)

        let response = await axios.post(url, toWeixinNeedData)
        let backData = response.data
        toWeixinNeedData = null

        //正确返回 {errcode:0}
        if (backData.errcode) {
            this.fail(backData)
        } else {
            this.success(backData)
            //组装入库json
            const saveJson = {
                user_id: condition.user_id,
                authorizer_appid: condition.authorizer_appid,
                info: JSON.stringify(data),
                is_del: '否',
                action: 'create',
            }

            //更新service_wechat_authorization_infos表menu_click字段
            this.saveWechatClickEventAction(condition, reply4click)
            this.saveWechatMenu(saveJson) //入库存储
        }
    }

    /**
     * 查询自定义菜单
     * 如果此用户有多个公众号，默认选第一个 返回limit
     */
    async getCurrentSelfmenuInfoAction() {
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

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').fetch
        let query = { access_token: authorizationInfos.authorizer_access_token }
        url += '?' + querystring.stringify(query)
        let response = await axios.get(url)

        //不存在  {errcode:46003, errmsg:menu no exist hint...}
        if (response.data.errcode) {
            this.fail(response.data)
        }
        //存在 正确返回 {errcode:0}
        else {
            response = response.data.menu
            this.success(response)
            //组装入库json
            const saveJson = {
                user_id: condition.user_id,
                authorizer_appid: condition.authorizer_appid,
                info: JSON.stringify(response),
                is_del: '否',
                action: 'fetch',
            }
            this.saveWechatMenu(saveJson)
        }
    }

    /**
     * 删除微信自定义菜单
     */
    async deleteWeixinSelfMenuAction() {
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
            return console.log('无此公众号')
        }

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').del
        let query = { access_token: authorizationInfos.authorizer_access_token }
        url += '?' + querystring.stringify(query)

        let response = await axios.get(url)
        let backData = response.data
        //正确返回 {errcode:0}
        if (backData.errcode) {
            this.fail(backData)
        }
        //删除数据库里此公众号所有的自定义菜单项目
        else {
            let ret = await this.model('service_wechat_menu').where(condition).delete()
            if (ret > 0) {
                this.success(backData)
            } else {
                console.error('删除自定义菜单微信成功，但本地数据库失败')
            }
        }
    }


    /**
     * 获取自定义菜单配置接口 获取B端用户公众号 自定义菜单
     */
    async getCurrentSelfmenuInfo2Action() {
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

        let url = think.config('WECHATapi').prefix + think.config('WECHATapi').current
        let query = { access_token: authorizationInfos.authorizer_access_token }
        url += '?' + querystring.stringify(query)

        let response = await axios.get(url)
        //不存在  {errcode:46003, errmsg:menu no exist hint...}
        if (response.data.errcode) {
            return this.fail(response.data)
        }

        let isOpen = response.data.is_menu_open
        if (isOpen) {
            let need = response.data.selfmenu_info.button
            let button = [] //把微信拿到的数据，组装成微信自定义菜单保存时需要的数据
            need.forEach(e => {
                let name = e.name
                let sub_button = [] //二级菜单 容器
                //有二级菜单且
                if (e.hasOwnProperty('sub_button')) {
                    e.sub_button.list.forEach(g => {
                        switch (g.type) {
                            case 'video':
                                g.type = 'click'
                                g.key = 'V1001_' + this.rnd(10000, 99999)
                                g.mode = 'video'
                                g.content = {
                                    media_id: g.value,
                                    newcat: '视频',
                                    description: '视频',
                                }
                                delete g.value
                                break;
                            case 'text':
                                g.type = 'click'
                                g.key = 'V1001_' + this.rnd(10000, 99999)
                                g.mode = 'text'
                                g.content = {
                                    text: g.value,
                                }
                                delete g.value
                                break;
                            case 'img':
                                g.type = 'click'
                                g.key = 'V1001_' + this.rnd(10000, 99999)
                                g.mode = 'image'
                                g.content = {
                                    media_id: g.value,
                                }
                                delete g.value
                                break;
                            case 'voice':
                                g.type = 'click'
                                g.key = 'V1001_' + this.rnd(10000, 99999)
                                g.mode = 'voice'
                                g.content = {
                                    media_id: g.value,
                                }
                                delete g.value
                                break;
                            case 'news':
                                g.type = 'click'
                                g.key = 'V1001_' + this.rnd(10000, 99999)
                                g.mode = 'news'
                                g.content = {
                                    list: g.news_info.list.map(h => {
                                        return {
                                            media_id: g.value,
                                            title: h.title,
                                            digest: h.digest,
                                            thumb_media_id: h.cover_url,
                                            url: h.content_url,
                                        }
                                    })
                                }
                                delete g.value
                                delete g.news_info
                                break;
                        }
                        sub_button.push(g)

                    })
                    button.push({ name, sub_button })
                }
                //只有一级菜单且有响应内容
                else {
                    switch (e.type) {
                        case 'video':
                            e.type = 'click'
                            e.key = 'V1001_' + this.rnd(10000, 99999)
                            e.mode = 'video'
                            e.content = {
                                media_id: e.value,
                                newcat: '视频',
                                description: '视频',
                            }
                            delete e.value
                            break;
                        case 'text':
                            e.type = 'click'
                            e.key = 'V1001_' + this.rnd(10000, 99999)
                            e.mode = 'text'
                            e.content = {
                                text: e.value,
                            }
                            delete e.value
                            break;
                        case 'img':
                            e.type = 'click'
                            e.key = 'V1001_' + this.rnd(10000, 99999)
                            e.mode = 'image'
                            e.content = {
                                media_id: e.value,
                            }
                            delete e.value
                            break;
                        case 'voice':
                            e.type = 'click'
                            e.key = 'V1001_' + this.rnd(10000, 99999)
                            e.mode = 'voice'
                            e.content = {
                                media_id: e.value,
                            }
                            delete e.value
                            break;
                        case 'news':
                            e.type = 'click'
                            e.key = 'V1001_' + this.rnd(10000, 99999)
                            e.mode = 'news'
                            e.content = {
                                list: e.news_info.list.map(h => {
                                    return {
                                        media_id: e.value,
                                        title: h.title,
                                        digest: h.digest,
                                        thumb_media_id: h.cover_url,
                                        url: h.content_url,
                                    }
                                })
                            }
                            delete e.value
                            delete e.news_info
                            break;
                    }
                    button.push(e)
                }
            })
            this.body = { button }
        } else {
            this.success({ isOpen })
        }
    }

    /**
     * 入库存储 自定义菜单的所有操作
     * @param {Object} saveJson 
     */
    async saveWechatMenu(saveJson) {
        let { user_id, authorizer_appid, info, is_del, action } = saveJson
        const now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
        let saveData = {
            user_id,
            authorizer_appid,
            info,
            is_del,
            action,
            create_at: now,
            update_at: now,
        }
        const model = this.model('service_wechat_menu')
        const isFail = await model.add(saveData).catch(err => {
            return think.isError(err) ? err : new Error(err)
        })

        if (think.isError(isFail)) {
            return this.fail(1005, isFail.message)
        } else {
            console.log(('添加成功 保存自定义菜单'))
        }
    }

    /**
     * 更新service_wechat_authorization_infos表menu_click字段
     */
    async saveWechatClickEventAction(condition, saveJson) {
        let json = JSON.stringify(saveJson)

        const model = this.model('service_wechat_authorization_infos')
        const isFail = await model.where(condition).update({ menu_click: json }).catch(err => {
            return think.isError(err) ? err : new Error(err)
        })

        if (think.isError(isFail)) {
            return this.fail(1005, isFail.message)
        } else {
            this.success('更新service_wechat_authorization_infos表menu_click字段成功')
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


    /**
     * @Date 2020.3.17
     * @param {Object} jsonFromUser 
     * 如果在调试中，发现用户无法收到响应的消息，可以检查是否消息处理超时。关于重试的消息排重，有msgid的消息推荐使用msgid排重。事件类型消息推荐使用FromUserName + CreateTime 排重。
     * { 接收到的样本
          "ToUserName": [ "gh_271edcbf742"], 
          "FromUserName": [ "oGsZY6KXRxplbO0owu1W31b2F0-I"], 
          "CreateTime": ["158443521" ], 
          "MsgType": [ "event" ], 
          "Event": [ "CLICK"], 
          "EventKey": ["V1001_TODAY_SINGER"]
      }
      */
    async handlerMsgtype(authorizer_appid, jsonFromUser) {
        // let isRepeat=await this.isRepeatMsg(jsonFromUser) //消息去重 当前日期后台日志未发现微信会多次发生相同消息，故暂时屏蔽
        // console.log('isrepeat', isRepeat)
        // if(isRepeat) { //重复不操作
        //   return this.body='success'
        // }

        // let [authorizer_access_token]=['']
        // let authorizationInfos=await this.model('service_wechat_authorization_infos').where({authorizer_appid}).field('authorizer_access_token, menu_click').find()
        // if(think.isEmpty(authorizationInfos)){
        //   console.error('无access token，无法回复用户消息')
        // }else{
        //   authorizer_access_token=authorizationInfos.authorizer_access_token
        // }

        let welcome = '您好，欢迎您！'
        let endFixJson = {}
        let rawData = ''

        //2. 用户操作产生的消息
        let [msgtype, openID, originAPPID] = ['', '', '']
        if (jsonFromUser.hasOwnProperty('ToUserName')) originAPPID = jsonFromUser.ToUserName[0]
        if (jsonFromUser.hasOwnProperty('FromUserName')) openID = jsonFromUser.FromUserName[0]
        if (jsonFromUser.hasOwnProperty('MsgType')) msgtype = jsonFromUser.MsgType[0]

        //判断接收的消息类型，再回复相应内容
        switch (msgtype) {
            //事件
            case 'event':
                const event = jsonFromUser.Event[0]
                switch (event) {
                    //收到 用户关注事件
                    case 'subscribe':
                        //用户关注
                        if (jsonFromUser.hasOwnProperty('EventKey')) {
                            endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，欢迎你关注我们]]>` }
                        }
                        //收到 普通用户关注事件
                        else {
                            endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，欢迎你关注我们2]]>` }
                        }
                        break;

                        //收到 用户取消关注事件 删除此用户一切入库信息
                    case 'unsubscribe':
                        this.body = 'success' //直接响应微信success
                        const condition = { from_user_name: jsonFromUser.FromUserName[0] }
                        await this.model('service_wechat_msg').where(condition).delete()
                        console.warn('已删除此用户一切入库信息')
                        break;

                        //收到 上报地理位置事件
                    case 'LOCATION':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[上报地理位置事件]]>` }
                        break;

                        //收到 自定义菜单的点击事件
                    case 'CLICK':
                        let menuToUserMsg = think.isArray(menuToUserMsgs) ? menuToUserMsgs.filter(e => e.authorizer_appid === authorizer_appid) : []
                        //唯一
                        if (menuToUserMsg.length === 1) {
                            menuToUserMsg = JSON.parse(menuToUserMsg[0].menu_click)
                            let mcItem = menuToUserMsg.find(e => e.key === jsonFromUser.EventKey[0])
                            if (!mcItem) {
                                this.body = 'success' //直接响应微信success
                                return this.saveWechatMsg(jsonFromUser) //存储但不往下执行
                            }

                            switch (mcItem.mode) {
                                case 'text': // 文本
                                    endFixJson = {
                                        MsgType: mcItem.mode,
                                        Content: `<![CDATA[${mcItem.content.text}]]>`
                                    }
                                    break;

                                case 'image': //回复图片 测试通过
                                    endFixJson = {
                                        MsgType: mcItem.mode,
                                        Image: {
                                            MediaId: `<![CDATA[${mcItem.media_id}]]>`,
                                        }
                                    }
                                    break;

                                case 'voice': //回复语音 测试通过 
                                    endFixJson = {
                                        MsgType: mcItem.mode,
                                        Voice: {
                                            MediaId: `<![CDATA[${mcItem.media_id}]]>`,
                                        }
                                    }
                                    break;

                                case 'video': //回复视频  测试通过
                                    endFixJson = {
                                        MsgType: mcItem.mode,
                                        Video: {
                                            MediaId: `<![CDATA[${mcItem.media_id}]]>`,
                                            Title: `<![CDATA[${mcItem.title}]]>`,
                                            Description: `<![CDATA[${mcItem.description}]]>`,
                                        }
                                    }
                                    break;

                                case 'music': //回复音乐 未测试 
                                    endFixJson = {
                                        MsgType: mcItem.mode,
                                        Music: {
                                            Title: `<![CDATA[吴青峰]]>`,
                                            Description: `<![CDATA[歌曲-起风了]]>`,
                                            MusicUrl: `<![CDATA[https://i.y.qq.com/v8/playsong.html?songid=256215395&source=yqq#wechat_redirect]]>`,
                                            HQMusicUrl: `<![CDATA[https://i.y.qq.com/v8/playsong.html?songid=256215395&source=yqq#wechat_redirect]]>`,
                                            ThumbMediaId: `<![CDATA[jePamzOh0hCXemRTSCbS2NWtkSf9gNKznGKUytaoOso]]>`,
                                        }
                                    }
                                    break;

                                case 'news': //回复图文 测试通过
                                    endFixJson = {
                                        MsgType: mcItem.mode,
                                        ArticleCount: mcItem.content.list.length,
                                        Articles: {
                                            item: mcItem.content.list.map(e => {
                                                return {
                                                    Title: `<![CDATA[${e.title}]]>`,
                                                    Description: `<![CDATA[${e.description}]]>`,
                                                    PicUrl: `<![CDATA[${e.picurl}]]>`,
                                                    Url: `<![CDATA[${e.url}]]>`,
                                                }
                                            })
                                        }
                                    }
                                    break;
                            }
                        }
                        //没有或非唯一
                        else {
                            this.body = 'success' //直接响应微信success
                            return this.saveWechatMsg(jsonFromUser) //存储但不往下执行
                        }
                        break;

                        //收到 跳转到链接页面
                    case 'VIEW':
                        this.body = 'success' //直接响应微信success
                        return this.saveWechatMsg(jsonFromUser) //存储但不往下执行
                        break;

                        //收到 点击菜单跳转小程序的事件推送
                    case 'view_miniprogram':
                        this.body = 'success' //直接响应微信success
                        return this.saveWechatMsg(jsonFromUser) //存储但不往下执行
                        break;

                        //收到 扫码推事件的事件推送
                    case 'scancode_push':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[扫码推事件的事件推送]]>` }
                        break;

                        //收到 扫码推事件且弹出“消息接收中”提示框的事件推送
                    case 'scancode_waitmsg':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[扫码推事件且弹出“消息接收中”提示框的事件推送]]>` }
                        break;

                        //收到 弹出系统拍照发图的事件推送
                    case 'pic_sysphoto':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[弹出系统拍照发图的事件推送]]>` }
                        break;

                        //收到 弹出拍照或者相册发图的事件推送
                    case 'pic_photo_or_album':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[弹出拍照或者相册发图的事件推送]]>` }
                        break;

                        //收到 弹出微信相册发图器的事件推送
                    case 'pic_weixin':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[弹出微信相册发图器的事件推送]]>` }
                        break;

                        //收到 弹出地理位置选择器的事件推送
                    case 'location_select':
                        endFixJson = { MsgType: 'text', Content: `<![CDATA[弹出地理位置选择器的事件推送]]>` }
                        break;
                }
                break;

                //收到文本
            case 'text':
                //接收不同内容 响应不同内容
                const reciver = jsonFromUser.Content[0]
                let strList = null

                try {
                    // 如果接收消息的授权方是测试公众号或测试小程序，则执行预设的测试用例
                    if ([think.config('auto_test').mp_name, think.config('auto_test').mini_program_name].includes(originAPPID)) {
                        console.log('\n\n\n>>> 检测到全网发布测试 <<<\n\n\n')
                        console.log('打印消息主体:')
                        console.log(jsonFromUser)

                        if (reciver === think.config('auto_test').text_content) {
                            rawData = think.config('auto_test').reply_text
                            console.log(`\n>>> 测试用例：被动回复消息；状态：已回复；回复内容：${think.config('auto_test').reply_text} <<<\n`)
                        } else if ((strList = reciver.split(':'))[0] === 'QUERY_AUTH_CODE') {
                            this.body = '' //立马回复微信空值
                            let auth_code = strList[1]
                            let content = `${strList[1]}_from_api`

                            console.log('strlist', strList)
                            console.log('strlist content', content)

                            let { authorization_info: { authorizer_access_token } } = await this.getWechatAuthorizationInfos2Action(auth_code)

                            let datajson = {
                                "touser": openID,
                                "msgtype": "text",
                                "text": {
                                    "content": content
                                }
                            }
                            console.log(`\n>>> 测试用例：主动发送客服消息；状态：已发送；发送内容：${content}} <<<\n`)
                            return this.sendMsgKf(authorizer_access_token, datajson)
                        }
                    } else {
                        if (reciver === '你好') {
                            rawData = '收到你好'
                        } else if (reciver === '哈哈') {
                            rawData = '收到哈哈'
                        } else {
                            rawData = '欢迎nnnnnnn'
                        }
                    }
                } catch (err) {
                    console.error('error', err)
                }

                endFixJson = {
                    MsgType: 'text',
                    Content: `<![CDATA[${rawData}]]>`
                }
                break;

                //收到图片
            case 'image':
                endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，已收到您的图片]]>` }
                break;

                //收到语音
            case 'voice':
                endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，已收到您的语音]]>` }
                break;

                //收到视频
            case 'video':
                endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，已收到您的视频]]>` }
                break;

                //收到小视频
            case 'shortvideo':
                endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，已收到您的小视频]]>` }
                break;

                //收到地理位置 
            case 'location':
                endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，已收到您的位置]]>` }
                break;

                //收到链接
            case 'link':
                endFixJson = { MsgType: 'text', Content: `<![CDATA[你好，已收到您的链接]]>` }
                break;

                //不是以上任何一种情况
            default:
                this.body = 'success' //直接响应微信success
                return this.saveWechatMsg(jsonFromUser) //存储但不往下执行
        }

        encodeAndSend(jsonFromUser, endFixJson)
    }


    /**
     * 存储 用户操作相关
     * @param {Object} jsonFromUser 
     * @param {Object} jsonToUser 
     */
    async saveWechatMsg(jsonFromUser, jsonToUser) {
        let [replyJson, is_reply] = [null, '已回复']

        //只有接收消息 有些消息不需要回复 如微信推的授权和取消授权等
        if (arguments.length === 1) {
            const unReply = '未回复或不用回复'
            replyJson = {
                MsgType: [unReply]
            }
            is_reply = unReply
        }
        //解析回复消息的xml->json
        else {
            replyJson = jsonToUser
        }
        let condition = { user_name: jsonFromUser.ToUserName[0] }

        const authorizerInfos = await this.model('service_wechat_authorizer_infos').where(condition).field('user_id, authorizer_appid').find()
        if (think.isEmpty(authorizerInfos)) {
            throw new Error('无此公众号')
        }

        const now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
        let modelData = {
            user_id: authorizerInfos.user_id,
            authorizer_appid: authorizerInfos.authorizer_appid,
            to_user_name: jsonFromUser.ToUserName[0],
            from_user_name: jsonFromUser.FromUserName[0],
            create_time: parseInt(jsonFromUser.CreateTime[0]),
            msg_type_get: jsonFromUser.MsgType[0],
            event: jsonFromUser.hasOwnProperty('Event') ? jsonFromUser.Event[0] : 'null',
            info_get: JSON.stringify(jsonFromUser),
            msg_id: jsonFromUser.hasOwnProperty('MsgId') ? jsonFromUser.MsgId[0] : 0,
            is_reply: is_reply, //已回复 未回复或不用回复
            msg_type_post: replyJson.MsgType,
            info_post: JSON.stringify(replyJson),
            create_at: now,
            update_at: now,
        }

        //增加
        const modelWechatMsg = this.model('service_wechat_msg')
        const isFail = await modelWechatMsg.add(modelData).catch(err => {
            return think.isError(err) ? err : new Error(err)
        })

        if (think.isError(isFail)) {
            return this.fail(1001, isFail.message);
        } else {
            console.log(('添加成功 saveWechatMsg'))
        }
    }

    /**
     * 存储 微信授权相关 授权成功 更新授权
     * @param {Object} jsonFromWeixin 
     */
    async saveWechatMsg2(jsonFromWeixin) {
        let user_id = ''
        let condition = { authorizer_appid: jsonFromWeixin.AuthorizerAppid[0] }

        if (jsonFromWeixin.InfoType[0] === 'authorized') {
            user_id = 'authorized'
        } else {
            const authorizerInfos = await this.model('service_wechat_authorizer_infos').where(condition).field('user_id, authorizer_appid').find()
            if (think.isEmpty(authorizerInfos)) {
                console.log('无此公众号')
            } else {
                user_id = authorizerInfos.user_id
            }
        }

        const now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
        let modelData = {
            user_id: user_id,
            authorizer_appid: condition.authorizer_appid,
            to_user_name: jsonFromWeixin.InfoType[0],
            from_user_name: jsonFromWeixin.InfoType[0],
            create_time: parseInt(jsonFromWeixin.CreateTime[0]),
            msg_type_get: jsonFromWeixin.InfoType[0],
            event: jsonFromWeixin.InfoType[0],
            info_get: jsonFromWeixin.InfoType[0],
            msg_id: jsonFromWeixin.InfoType[0],
            is_reply: '未回复或不用回复',
            msg_type_post: jsonFromWeixin.InfoType[0],
            info_post: jsonFromWeixin.InfoType[0],
            create_at: now,
            update_at: now,
        }

        //增加
        const modelWechatMsg = this.model('service_wechat_msg')
        const isFail = await modelWechatMsg.add(modelData).catch(err => {
            return think.isError(err) ? err : new Error(err)
        })

        if (think.isError(isFail)) {
            return this.fail(1001, isFail.message);
        } else {
            console.log(('添加成功 saveWechatMsg'))
        }
    }

    /**
     * 获取自定义菜单设置 （从数据库）
     */
    async getWechatMenuFromDBAction() {
        const { user_id, authorizer_appid } = this.post()

        const condition = {
            user_id,
            authorizer_appid
        }

        let wechatMenu = await this.model('service_wechat_menu').limit(1).order('create_at desc').where(condition).field('info, is_del, create_at').find()
        wechatMenu.info = JSON.parse(wechatMenu.info)

        if (think.isEmpty(wechatMenu)) {
            this.fail('wechatMenuFromDB 无此记录')
        } else {
            this.success(wechatMenu)
        }
    }
}