// default config
module.exports = {
    workers: 1,

    //替换成自己微信开放平台的参数
    WX: {
        appid: 'wx1234567890', //appid           
        appsecret: 'xxxxxxxxxxxxxxxxxxxx', //Secret          
        token: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', //Token           
        key: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', //加密Key         
    },

    // 接口URL
    WECHATapi: {
        prefix: 'https://api.weixin.qq.com/cgi-bin/', //前缀

        //授权
        componentToken: 'component/api_component_token', //令牌
        createPreauthcode: 'component/api_create_preauthcode', //预授权码
        queryAuth: 'component/api_query_auth', //使用授权码获取授权信息
        authorizerToken: 'component/api_authorizer_token', //获取/刷新接口调用令牌
        getAuthorizerOption: 'component/api_get_authorizer_option', //获取授权方选项信息
        setAuthorizerOption: 'component/api_set_authorizer_option', //设置授权方选项信息
        getAuthorizerList: 'component/api_get_authorizer_list', //拉取所有已授权的帐号信息

        openCreate: 'open/create', //创建开放平台帐号并绑定公众号/小程序
        openBind: 'open/bind', //将公众号/小程序绑定到开放平台帐号下
        openUnbind: 'open/unbind', //将公众号/小程序从开放平台帐号下解绑
        openGet: 'open/get', //获取公众号/小程序所绑定的开放平台帐号


        //自定义菜单
        create: 'menu/create',
        fetch: 'menu/get',
        del: 'menu/delete',
        current: 'get_current_selfmenu_info',

        //消息管理

        //素材管理
        upload: 'media/upload', //新增临时素材
        media_get: 'media/get', //获取临时素材
        add_news: 'material/add_news', //新增永久图文素材
        uploadimg: 'media/uploadimg', //上传图文消息内的图片获取URL
        add_material: 'material/add_material', //新增其他类型永久素材
        get_material: 'material/get_material', //获取永久素材
        del_material: 'material/del_material', //删除永久素材
        update_news: 'material/update_news', //修改永久图文素材
        get_materialcount: 'material/get_materialcount', //获取素材总数
        batchget_material: 'material/batchget_material', //获取素材列表


        //小程序管理权限集
        wxamplinkget: 'wxopen/wxamplinkget', //获取公众号关联的小程序
        wxamplink: 'wxopen/wxamplink', //关联小程序
        wxampunlink: 'wxopen/wxampunlink', //解除已关联的小程序

        //模板消息接口
        setIndustry: 'template/api_set_industry', //设置所属行业
        getIndustry: 'template/get_industry', //获取设置的行业信息
        addTemplate: 'template/api_add_template', //获得模板ID
        getAllPrivateTemplate: 'template/get_all_private_template', //获取模板列表
        delPrivateTemplate: 'template/del_private_template', //删除模板
        msgTemplateSend: 'message/template/send', //发送模板消息

        //客服消息
        prefixKF: 'https://api.weixin.qq.com/customservice/', //客服消息前缀
        addKfaccount: 'kfaccount/add', //添加客服帐号
        updateKfaccount: 'kfaccount/update', //修改客服帐号
        delKfaccount: 'kfaccount/del', //删除客服帐号
        uploadHeadimgKfaccount: 'kfaccount/uploadheadimg', //设置客服帐号的头像

        getKflist: 'customservice/getkflist', //获取所有客服账号

        sendMsgKf: 'message/custom/send', //客服接口-发消息
        typingMsgKf: 'message/custom/typing', //客服输入状态
    },

    //微信被动回复用户消息类型
    replyType: {
        'text': {
            'MsgType': 'text',
            'Content': 0
        },

        'image': {
            'Image': {
                'MediaId': 0
            }
        },

        'voice': {
            'Voice': {
                'MediaId': 0
            }
        },

        'video': {
            'Video': {
                'MediaId': 0,
                'Title': 1,
                'Description': 2
            }
        },

        'music': {
            'Music': {
                'ThumbMediaId': 0,
                'HQMusicUrl': 1,
                'MusicUrl': 2,
                'Title': 3,
                'Description': 4
            }
        },

        'news': {
            'ArticleCount': 1,
            'Articles': 0
        }
    },

    // 全网发布自动化测试的账号
    auto_test: {
        mp_appid: 'wx570bc396a51b8ff8', // 测试公众号appid
        mp_name: 'gh_3c884a361561', // 测试公众号名称
        mini_program_appid: 'wxd101a85aa106f53e', // 测试小程序appid
        mini_program_name: 'gh_8dad206e9538', // 测试小程序名称
        text_content: 'TESTCOMPONENT_MSG_TYPE_TEXT', // 固定文本
        reply_text: 'TESTCOMPONENT_MSG_TYPE_TEXT_callback', // 固定文本
    },

}