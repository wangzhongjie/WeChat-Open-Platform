
- WeChat Open Platform API developing By Nodejs+Thinkjs+Mysql
- 用Nodejs、Thinkjs开发微信开放平台的公众号、小程序开发，包括授权相关、自定义菜单、素材管理、消息模板、客服等功能0



## API
#### 授权相关
- 接收平台验证票据
- 接收平台令牌
- 获取平台预授权码 
- 获取平台微信授权后回调页URI的数据
- 消息与事件接收URL

- 获取公众号的AccessToken
- 定时刷新公众号的AccessToken
- 获取公众号基本信息 - 从微信
- 获取公众号基本信息 - 给前端
- 拉取所有已授权的帐号信息 - 从微信
- 拉取所有已授权的帐号信息 - 给前端
- 获取授权方选项信息
- 设置授权方选项信息

- 全网发布测试接口

#### 自定义菜单
- 创建自定义菜单
- 查询自定义菜单
- 删除自定义菜单 
- 获取自定义菜单配置
- 获取自定义菜单设置 - 从数据库

#### 素材管理
- 获取永久素材
- 获取临时素材
- 获取素材列表
- 获取素材总数

#### 消息模板
- 获取模板列表
- 获得模板ID

#### 客服
- 发消息


# 一些数据来回传输解密后的数据

### 自定义菜单公众号和用户交互时来回的数据
view 微信给我们
```
{
    "type": "view",
    "name": "出单系统",
    "url": "http://mp.weixin.qq.com/s?__biz=MzI2OTExOTR4OQ==&mid=2649158226&idx=2&sn=c2d3bcc369327a4655683d5b24ea2d55&chksm=f2f7694cc580e05a40a1f22558263535b9c30f320d2c03a3da67e82d664fa12cd61b3807f55b&scene=18#wechat_redirect"
}
```
我们给微信
```
{
    "type": "view", 
    "name": "预约维修", 
    "url": "https://aaaaaa”, 
    "sub_button": [ ]
}
```

miniprogram ————————————————————————————————
微信给我们
```
{
    "type": "miniprogram",
    "name": "小程序",
    "url": "http://aaaaa”,
    "appid": "wx66e1dalw23ofa6f",
    "pagepath": "pages/app-login/app-login"
}
```
我们给微信
```
{
	 "type":"miniprogram",
	 "name":"wxa",
	 "url":"http://mp.weixin.qq.com",
	 "appid":"wx286akjdf2j34bbf93aa",
	 "pagepath":"pages/lunar/index"
}
```

video ————————————————————————————————
微信给我们
```
{
    "type": "video",
    "name": "video",
    "value": "http://mp.weixin.qq.com/mp/mp/video?__biz=MzI2alkj232423kjlakxOTA4OQ==&mid=501674603&sn=d9b156436262c5edff34f0eb50bc3075&vid=wxv_1257374601668083713&idx=1&vidsn=b4ccda011c35878ca95f655620d3a8e1&fromid=1#rd"
}
```
我们给微信
```
{
    "type": "click", 
    "name": "视频", 
    "key": "V1001_1585279954653", 
    "content": {
        "media_id": "jePamzOh0wkqj234j3jfS2NYRqobk060l1LQWeusYSCU", 
        "newcat": "动漫", 
        "description": “xxx”
    }, 
    "mode": "video"
}
```
text ————————————————————————————————
微信给我们
```
{
    "type": "text",
    "name": "text",
    "value": "adasdfewqerwerqwr[抓狂]"
}
```
我们给微信
```
{
    "type": "click", 
    "name": "非车险", 
    "key": "V1001_1585214733539", 
    "content": {text:"tttt"}, 
    "mode": "text"
}
```

news ————————————————————————————————
微信给我们
```
{
    "type": "news",
    "name": "news",
    "value": "jePamzOh0jr2o3ij423oj4S2P2aBrz0Ir8pzmJQdUFKgnw",
    "news_info": {
        "list": [
            {
                "title": "hahahahahah",
                "author": "wew",
                "digest": "wewrwerew",
                "show_cover": 0,
                "cover_url": "http://mmbiz.qpic.cn/mmbiz_jpg/EnVpI6ZR1ljqlkw3jlk32jfIHZ66atjknLg2cndIDOCa1PhXFvpVVAXK7bUSmUZnRbRctosUYuynMZ3cCQTCZU1PZg/0?wx_fmt=jpeg",
                "content_url": "http://mp.weixin.qq.com/s?__biz=MzI2sljalkj23jA4OQ==&mid=501674612&idx=1&sn=8b5b4bcf98e92b2d23ef22ec3041ef4e&chksm=72f7696a4580e07cf3967e49141a60b29d079a4c9c15dfa8420c6396bb3d3690c894e91e73f1#rd",
                "source_url": ""
            }
        ]
    }
}
```
我们给微信
```
{
    "type": "click", 
    "name": "bbbbb", 
    "key": "V1001_1585279928428", 
    "mode": "news", 
    "content": {
    	list:[
    		"media_id": "jePamzfljo3j2423ljfSCbS2Dc3RxUhZPG-TRJTD1OMY_A", 
	        "title": "震惊，好易保很好用！", 
	        "digest": "“ 引言部分，总领全篇文章的中心内容。”正文内容从这里开始（可直接省略，亦可配图说明）。01—标题内容1第一", 
	        "thumb_media_id": "jePamsaknflkqwjrl23kjRTSCbS2BbQ0L9cRX58qXhoSd3ELpE", 
	        "url": "http://mp.weixin.qq.com/s?__biz=MzI2Ok2j34kjf4OQ==&mid=501674610&idx=1&sn=cac9d3b7cbd1dd6aec7659dc1fa0882f&chksm=72f7696c4580e07a0e1901c4c50465357be48a362e51bcd97fef0175d7bbe0d5efec293ca882#rd"
    	]
    }
}
```

image ————————————————————————————————
微信给我们
```
{
    "type": "img",
    "name": "image",
    "value": "dSAy4NgFJtu4lkfj23lkj4vwNzdbgyjexrda6t7qK1N-qPdTsax4sKvA09C"
}
```
我们给微信
```
{
    "type": "click", 
    "name": "寿险", 
    "key": "V1001_1585226153133", 
    "content": {
        "media_id": "jePamzOh0l2kj3lk423mRTSCbS2J-Ktes5YcKQiXbyixYwrSk"
    }, 
    "mode": "image"
}
```

voice ————————————————————————————————
微信给我们
```
{
    "type": "voice",
    "name": "voice",
    "value": "DAyB8oZFil9UKaJdDsjflkwjr2CE8qEFV4kBj3H0KD9lKHQF0fdmLQiU-E-gIv_8"
}
```
我们给微信
```
{
    "type": "click", 
    "name": "意外险", 
    "key": "V1001_1585226220198", 
    "content": {
        "media_id": "jePamzsljflwekjrCXemRTSCbS2BuGnL_f6Uhu-2zv1RaKrS4"
    }, 
    "mode": "voice"
}
```



# License
[MIT](http://opensource.org/licenses/MIT)
