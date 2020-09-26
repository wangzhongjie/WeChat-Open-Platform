
- a Third-party payment platform(WeChat Pay) API developing By Nodejs+Thinkjs+Mysql
- 用Nodejs、Thinkjs开发微信开放平台公众号开发，包括授权相关、自定义菜单、素材管理、消息模板、客服等功能。weixin open dev for nodejs



## API
- 拉起支付二维码：wxPay/toPay
- 定时轮询支付结果： wxPay/wxPay/queryOrder
- 关单：wxPay/doCloseOrder





## Install dependencies

```
npm install
```

## Start server

```
npm start
```

## Deploy with pm2

Use pm2 to deploy app on production enviroment.

```
pm2 startOrReload pm2.json
```

# License
[MIT](http://opensource.org/licenses/MIT)