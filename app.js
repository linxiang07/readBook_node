/**
 * Created by feverdestiny on 2017/9/22.
 */
const cheerio = require("cheerio");
const request = require("request");
const c2nmoney = require('c2nmoney').c2n;
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const baseURL = "https://www.wmdown8.com";
let url = `${baseURL}/novel/zsHsd4.html`; //小说Url

class LoadBook {
    _list = [];
    _booksName = null;
    _count = 0;
    _read = './read.json';

    _getTitleIndexValue(title) {
        const dIndex = title.indexOf('第');
        const zIndex = title.indexOf('章');
        const num = title.slice(dIndex + 1, zIndex);
        return isNaN(+num) ? c2nmoney(num).n : num;
    }
    _formatLsit(params) {
        if (!Array.isArray(params)) { return []; }
        let arr = params.slice();
        arr = arr.map((item) => ({ ...item, title: (item.title || '').replace('章', '章 ') }));
        arr = arr.sort((a, b) => {
            const numA = this._getTitleIndexValue(a.title);
            const numB = this._getTitleIndexValue(b.title);
            return numA - numB;
        })
        return arr;
    }
    _createFolder(to) { //文件写入
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
    async _setReadJson(params) {
        if (await fs.existsSync(this._read)) {
            this._createFolder(this._read);
        }
        await fsPromises.writeFile(path.join(__dirname, this._read), JSON.stringify(params, null, 2), (err) => {
            if (err) throw err;
        });
    }
    async booksQuery(body) {
        if (!fs.existsSync('/read.json')) {
            const $ = cheerio.load(body);
            let infoDom = $('#info');
            if (infoDom.html() === null) {
                infoDom = $('.info');
            }
            this._booksName = infoDom.find('h1').text().trim(); //小说名称
            let listDom = $('#list');
            if (listDom.html() === null) {
                listDom = $('.listmain');
            }
            listDom.find('a').each((i, e) => { //获取章节UrlList
                const baseKey = $(e).attr('href');
                this._list.push({ key: baseKey.includes('http') ? baseKey : baseURL + $(e).attr('href'), title: $(e).text(), isLoad: false })
            });
            this._list = this._formatLsit(this._list);
            await this._setReadJson(this._list)
        }
        if (await !fs.existsSync(`/book/${this._booksName}.txt`)) {
            this._createFolder(path.join(__dirname, `/book/${this._booksName}.txt`)); //创建文件夹
            fs.createWriteStream(path.join(__dirname, `/book/${this._booksName}.txt`)) //创建txt文件
        }
        console.log(`开始写入《${this._booksName}》·······`)
        this.getBody(); //获取章节信息
    }
    getBody() {
        const rr = require('./read.json');
        const readItem = rr.find((item) => !item.isLoad);
        if (rr.every((item) => item.isLoad)) {
            console.log('下载完成！！！！！！');
            return;
        }
        Object.keys(require.cache).forEach((key) => {
            delete require.cache[key];
        })
        let primUrl = readItem.key.includes('http') ? readItem.key : url + readItem.key;
        console.log(`进度: \x1B[36m ${((rr.filter((item) => item.isLoad).length / rr.length) * 100).toFixed(2)}%\x1B[39m,   下载地址: \x1B[36m${readItem.key}\x1B[39m,  下载章节: \x1B[36m${readItem.title}\x1B[39m`)
        request(primUrl, { timeout: 10000 }, async (err, res, body) => {
            if (!err && res.statusCode == 200) {
                await this._setReadJson(rr.map((item) => {
                    if (item.key === readItem.key) {
                        return { ...item, isLoad: true };
                    }
                    return item;
                }))
                this.toQuery(body);

            } else {
                console.log('err:' + err)
                this.getBody()
            }
        })
    }
    async toQuery(body) {
        const $ = cheerio.load(body);
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
        await this.writeFs(title, content.trim());
    }
    async writeFs(title, content) {
        // 添加数据
        fs.appendFile(path.join(__dirname, `/book/${this._booksName}.txt`), `\n${title}\n　　${content}`, (err) => {
            if (err) {
                console.log(err)
            } else {
                console.log(`\x1B[32m保存成功:\x1B[39m \x1B[93m${title}\x1B[39m `)
                if (this._count + 1 < this._list.length) { //当前页码是否超过章节数
                    this._count ++;
                    this.getBody();
                }
            }
        });
    }
    start() {
        request(url, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                console.log(`获取小说基本信息成功·······`)
                this.booksQuery(body);
            } else {
                console.log('err:' + err)
            }
        })
    }
}
const loadBook = new LoadBook();
loadBook.start();