/**
 * Created by feverdestiny on 2017/9/22.
 */
const cheerio = require("cheerio");
const request = require("request");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
let count = 0; //叠加
let url = 'http://www.81zw.me/book/111138/'; //小说Url
let list = []; //章节List
let booksName = ''; //小说名称
let read = './read.json'; // 配置文件位置

/**
 * 获取小说目录页
 */
function books() {
    request(url, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            console.log(`获取小说基本信息成功·······`)
            booksQuery(body);
        } else {
            console.log('err:' + err)
        }
    })
}
/**
 * 处理小说名称及其小说目录
 * @param {*} body 
 */
async function booksQuery(body) {
    if (!fs.existsSync('/read.json')) {
        $ = cheerio.load(body);
        booksName = $('#info').find('h1').text().trim(); //小说名称
        $('#list').find('a').each(function (i, e) { //获取章节UrlList
            list.push({ key: $(e).attr('href'), title: $(e).text(), isLoad: false })
        });
        await setReadJson(list)
    }
    if (await !fs.existsSync(`/book/${booksName}.txt`)) {
        createFolder(path.join(__dirname, `/book/${booksName}.txt`)); //创建文件夹
        fs.createWriteStream(path.join(__dirname, `/book/${booksName}.txt`)) //创建txt文件
    }

    console.log(`开始写入《${booksName}》·······`)
    getBody(); //获取章节信息
}
/**
 * 获取章节页面信息
 * 
 */
function getBody() {
    const rr = require('./read.json');
    const readItem = rr.find((item) => !item.isLoad);
    if (rr.every((item) => item.isLoad)) {
        console.log('下载完成！！！！！！');
        return;
    }
    Object.keys(require.cache).forEach(function (key) {
        delete require.cache[key];
    })
    let primUrl = url + readItem.key;
    console.log(`进度: \x1B[36m ${((rr.filter((item) => item.isLoad).length / rr.length) * 100).toFixed(2)}%\x1B[39m,   下载地址: \x1B[36m${readItem.key}\x1B[39m,  下载章节: \x1B[36m${readItem.title}\x1B[39m`)
    request(primUrl, { timeout: 10000 }, async function (err, res, body) {
        if (!err && res.statusCode == 200) {
            await setReadJson(rr.map((item) => {
                if (item.key === readItem.key) {
                    return { ...item, isLoad: true };
                }
                return item;
            }))
            toQuery(body);

        } else {
            console.log('err:' + err)
            getBody()
        }
    })
};
/**
 * 处理章节页面信息
 * @param {any} body 
 */
async function toQuery(body) {
    $ = cheerio.load(body);
    let title = $('h1').text(); //获取章节标题
    if (!/^第.*章/.test(title) && String(title).includes('、')) {
        const arr = title.split('、');
        const obj = arr.shift();
        if (obj) {
            title = `第${obj}章 ${arr.join('、')}`
        }
    }
    let content = String($('#content').html()).replace(/<br>/g, '\n'); //获取当前章节文本内容并去除文本所有空格
    content = content.replace('<script type="text/javascript" src="/js/chaptererror.js"></script>', '');
    content = content.replace(/&nbsp;/g, '');
    await writeFs(title, content.trim());
}
/**
 * 写入txt文件
 * @param {*} title 
 * @param {*} content 
 */
async function writeFs(title, content) {
    // 添加数据
    fs.appendFile(path.join(__dirname, `/book/${booksName}.txt`), `\n${title}\n　　${content}`, function (err) {
        if (err) {
            console.log(err)
        } else {
            console.log(`\x1B[32m保存成功:\x1B[39m \x1B[93m${title}\x1B[39m `)
            if (count + 1 < list.length) { //当前页码是否超过章节数
                count = count + 1;
                getBody();
            }
        }
    });
}
/**
 * 创建文件夹
 * 
 * @param {any} to 
 */
function createFolder(to) { //文件写入
    var sep = path.sep
    var folders = path.dirname(to).split(sep);
    var p = '';
    while (folders.length) {
        p += folders.shift() + sep;
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p);
        }
    }
};

async function setReadJson(params) {
    if (await fs.existsSync(read)) {
        createFolder(read);
    }
    await fsPromises.writeFile(path.join(__dirname, read), JSON.stringify(params, null, 2), function (err) {
        if (err) throw err;
    });
}


books();