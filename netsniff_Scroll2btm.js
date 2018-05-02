if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

function createHAR(address, title, startTime, resources)
{
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;

        if (!request || !startReply || !endReply) {
            return;
        }

        // Exclude Data URI from HAR file because
        // they aren't included in specification
        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
    }

        entries.push({
            startedDateTime: request.time.toISOString(),
            time: endReply.time - request.time,
            request: {
                method: request.method,
                url: request.url,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: -1,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: -1,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType
                }
            },
            cache: {},
            timings: {
                blocked: 0,
                dns: -1,
                connect: -1,
                send: 0,
                wait: startReply.time - request.time,
                receive: endReply.time - startReply.time,
                ssl: -1
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2',
            creator: {
                name: "PhantomJS",
                version: phantom.version.major + '.' + phantom.version.minor +
                    '.' + phantom.version.patch
            },
            pages: [{
                startedDateTime: startTime.toISOString(),
                id: address,
                title: title,
                pageTimings: {
                    onLoad: page.endTime - page.startTime
                }
            }],
            entries: entries
        }   
    };
}

var page = require('webpage').create(),
    system = require('system');

if (system.args.length !== 3) {
    console.log('Usage: netsniff.js <some URL> <plat>  ; more about plat: 1-wx,2-sq');
    phantom.exit(1);
} else {
    page.address = system.args[1];
    page.plat = system.args[2]  // 约定 微信环境-1，手Q环境-2
    page.resources = [];

    page.settings.resourceTimeout = 600000;     //设置请求超时时间时间为10min
    page.onResourceTimeout = function(request) {
        console.log("time out：60s;");
        console.log('Response (#' + request.id + '): ' + JSON.stringify(request));
        har = createHAR(page.address, page.title, page.startTime, page.resources);
        console.log(JSON.stringify(har, undefined, 4));
        phantom.exit(1);
    };

    page.onLoadStarted = function () {
        page.startTime = new Date();
    };

    page.onResourceRequested = function (req) {
        page.resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
    };

    page.onResourceReceived = function (res) {
        if (res.stage === 'start') {
            page.resources[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            page.resources[res.id].endReply = res;
        }
    };

    //console.log("phantom.cookiesEnabled",phantom.cookiesEnabled);
     phantom.addCookie({
        'name':'wq_uin',
        'value':'479407736',
        'domain':'.jd.com',
        'path':'/'
    });
    phantom.addCookie({
        'name':'wq_skey',
        'value':'zqE1B347E7374C6B010C8064628307DF1E68597E11C6CBD49C2FEB8271121B324133FDE6DEDBCD6D55096AF5C7E0557FFB',
        'domain':'.jd.com',
        'path':'/'
    }); 
    phantom.addCookie({
        'name':'pin',
        'value':'test',
        'domain':'.jd.com',
        'path':'/'
    }); 
    phantom.addCookie({//pin 的value随便填
        'name':'pin',
        'value':'test',
        'domain':'.jd.com',
        'path':'/'
    });
    phantom.addCookie({//visitkey 的value随便填
        'name':'visitkey',
        'value':'dsjd',
        'domain':'.jd.com',
        'path':'/'
    });
    // 【区分微信手Q渠道，选择不同的UA】为了拉取webp图片，不用iOS UA 。
    // 手Q一些馆区页面打开时自动登录，需要设置QQ环境下的UA和cookies信息。
    // 有些微信下的页面做了UA强校验，非微信环境不能打开页面，或者直接跳转qq环境下的页面链接。坑。。。。
    if (page.plat == 1){           //使用弱等于比较，也就是说参数plat为字符'1'或者数字1，结果都是true。外部参数相对随意些。
        page.settings.userAgent = "Mozilla/5.0 (Linux; Android 6.0; EVA-AL00 Build/HUAWEIEVA-AL00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043220 Safari/537.36 MicroMessenger/6.5.7.1041 NetType/WIFI Language/zh_CN"
    } else {
        page.settings.userAgent = "Mozilla/5.0 (Linux; Android 6.0; EVA-AL00 Build/HUAWEIEVA-AL00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043220 Safari/537.36 QQ/6.5.7.1041 NetType/WIFI Language/zh_CN"
    }

     // 输出页面js在控制台console输出的调试信息。调试时使用看是否滚动加载js请求。获取har树时请关闭。
//      page.onConsoleMessage = function(msg) {
//		  console.log(msg);
//      }

    page.open(page.address, function (status) {
        var har;
        if (status !== 'success') {
            console.log('FAIL to load the address');
            phantom.exit(1);
        } else {
            page.endTime = new Date();
            page.title = page.evaluate(function () {
                return document.title;
            });

            var oldHeight = page.evaluate(function(){
                return Math.max(document.body.scrollTop || document.documentElement.scrollTop);
            });
            var winHeight = page.evaluate(function(){
                return window.screen.height;
            });
            function Scroll2btm(){
                var newHeight = page.evaluate(function(){
                    return Math.max(document.body.scrollHeight || document.documentElement.scrollHeight);
                });
                // 调试时使用，获取har树时请关闭
                // console.log("Scroll2btm...oldHeight: " + oldHeight + " , winHeight: " + winHeight + " , newHeight: " + newHeight);
                // page.render("../result/H_" + oldHeight + ".jpeg");
                /*******
                1. 首屏加载后先滚动一次，如果触发新的js请求，下次定时器启动执行Scroll2btm重新获取页面高度scrollHeight会变化新的值
                2. 滚动一次后新填充的数据是否有一屏的高度。如果新填充的数据至少有一屏的高度，继续触发定时器执行Scroll2btm。
                3. 每次定时器执行滚动后判断新填充数据后的页面高度，新增数据少于一屏的高度，定时器停止，page.resources监听到滚动到页面底部的所有请求。
                *******/                
                if (oldHeight < newHeight){ 
                    page.evaluate(function(){
                        window.scrollTo(0, Math.max(document.body.scrollHeight || document.documentElement.scrollHeight));
                    });
                    oldHeight = newHeight;
                    setTimeout(Scroll2btm, 3000);
                }else if (oldHeight == newHeight) {  // 滑动到底部继续触发一次，看是否继续触发
                    oldHeight = oldHeight + winHeight;
                    page.evaluate(function(){
                        window.scrollTo(0, Math.max(document.body.scrollHeight || document.documentElement.clientHeight) + window.screen.height);
                    });
                    setTimeout(Scroll2btm, 3000);
                }else {
                    // console.log("buildhar...oldHeight: " + oldHeight + " , winHeight: " + winHeight + " , newHeight: " + newHeight);
                    setTimeout(function(){
                        har = createHAR(page.address, page.title, page.startTime, page.resources);
                        console.log(JSON.stringify(har, undefined, 4));
                        // page.render("../result/btm.jpeg");
                        phantom.exit();
                    },5000)
                }
            };
            Scroll2btm();
        }
    }); 
}
