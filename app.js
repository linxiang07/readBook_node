/**
 * Created by feverdestiny on 2017/9/22.
 */
const cheerio = require("cheerio");
const request = require("request");
const c2nmoney = require('c2nmoney').c2n;
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
let count = 0; //叠加
const baseURL = "https://www.wmdown8.com";
let url = `${baseURL}/novel/QJ0dN6DLdLO.html`; //小说Url
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
function getTitleIndexValue(title) {
    const dIndex = title.indexOf('第');
    const zIndex = title.indexOf('章');
    const num = title.slice(dIndex + 1, zIndex);
    return isNaN(+num) ? c2nmoney(num).n : num;
}
function formatLsit(params) {
    if (!Array.isArray(params)) {return [];}
    let arr = params.slice();
    arr = arr.map((item) => ({ ...item, title: (item.title || '').replace('章', '章 ') }));
    arr = arr.sort((a, b) => {
        const numA = getTitleIndexValue(a.title);
        const numB = getTitleIndexValue(b.title);
        return numA - numB;
    })
    return arr;
}

/**
 * 处理小说名称及其小说目录
 * @param {*} body f
 */
async function booksQuery(body) {
    if (!fs.existsSync('/read.json')) {
        $ = cheerio.load(body);
        let infoDom = $('#info');
        if (infoDom.html() === null) {
            infoDom = $('.info');
        }
        booksName = infoDom.find('h1').text().trim(); //小说名称
        let listDom = $('#list');
        if (listDom.html() === null) {
            listDom = $('.listmain');
        }
        listDom.find('a').each(function (i, e) { //获取章节UrlList
            const baseKey = $(e).attr('href');
            list.push({ key: baseKey.includes('http') ? baseKey : baseURL + $(e).attr('href'), title: $(e).text(), isLoad: false })
        });
        list = formatLsit(list);
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
    let primUrl = readItem.key.includes('http') ? readItem.key : url + readItem.key;
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
    // 标题形式: 1、
    if (!/^第.*章/.test(title) && String(title).includes('、')) {
        const arr = title.split('、');
        const obj = arr.shift();
        if (obj) {
            title = `第${obj}章 ${arr.join('、')}`
        }
    }
    // 标题形式: x.
    if (!/^第.*章/.test(title) && /^[0-9]*\./.test(title)) {
        const arr = title.split('.');
        const obj = arr.shift();
        if (obj) {
            title = `第${obj}章 ${arr.join('.')}`
        }
    }
    // 标题形式: x 
    if (!/^第.*章/.test(title) && /^[0-9]*\s/.test(title)) {
        const arr = title.split(' ');
        const obj = arr.shift();
        if (obj) {
            title = `第${obj}章 ${arr.join(' ')}`
        }
    }
    $('[class="bottem"]').remove();
    let content = String($('#content').html()).replace(/<br>/g, '\n'); //获取当前章节文本内容并去除文本所有空格
    content = content.replace(/<p>/g, ''); //获取当前章节文本内容并去除文本所有空格
    content = content.replace(/<\/p>/g, '\n\n'); //获取当前章节文本内容并去除文本所有空格
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