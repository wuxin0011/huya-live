// ==UserScript==
// @name         直播插件
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  虎牙直播、斗鱼直播 页面简化，屏蔽主播直播间
// @author       wuxin001
// @match        https://www.huya.com/*
// @match        https://www.douyu.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';
    const huya_address_pattern = /^https:\/\/.*\.huya\.((com)|(cn)).*/
    const doyu_address_pattern = /^https:\/\/.*\.douyu\.((com)|(cn)).*/
    const bg_regx = /^http[s](.*)(\.(png|jpg|jpeg).*)$/;
    const local_url = window.location.href
    const is_huya = huya_address_pattern.test(local_url) // 是否是虎牙地址
    const is_douyu = doyu_address_pattern.test(local_url) // 是否是斗鱼地址
    const wd = window.document
    const wls = window.localStorage // 简化存储对象
    const download_plugin_url =
        'https://greasyfork.org/zh-CN/scripts/449261-%E8%99%8E%E7%89%99%E7%9B%B4%E6%92%AD' // 下载地址
    const source_code_url = 'https://github.com/wuxin0011/huya-live' // 源码地址

    const time = 2000 //延迟时间

    /**
     * 页面加载完成调用该方法！
     */
    window.onload = () => {
        setTimeout(() => {
            try {
                let text = is_huya ? '虎牙' : '斗鱼'
                text = '%c欢迎使用' + text + '直播插件,下载地址%c'
                console.log(
                    text
                    .concat(download_plugin_url, ''),
                    'background: rgb(255, 93, 35); padding: 1px; border-radius: 3px 0 0 3px; color: #fff',
                    'border-radius: 0 3px 3px 0; color: #fff')
                console.log(
                    '%c源码地址:%c '
                    .concat(source_code_url, ''),
                    'background: rgb(255, 93, 35); padding: 1px; border-radius: 3px 0 0 3px; color: #fff',
                    'border-radius: 0 3px 3px 0; color: #fff')

                //插件执行入口
                if (is_huya) {
                    // 执行虎牙直播插件
                    new TriggerLive()
                } else if (is_douyu) {
                    // 执行斗鱼直播插件
                    new FishLive()
                } else {
                    log('插件地址不适配，请检查匹配地址！！！', 'warn')
                }
            } catch (e) {
                log(e, 'error')
            }

        }, time)
    }



    /**
     * 日志输出
     */
    const log = (msg, level = 'log') => {
        try {
            if (level == 'log') {
                console.log(new Date().toLocaleString(), msg);
            }
            if (level == 'info') {
                console.info(new Date().toLocaleString(), msg);
            }
            if (level == 'warn') {
                console.warn(new Date().toLocaleString(), msg);
            }
            if (level == 'error') {
                console.error(new Date().toLocaleString(), msg);
            }
        } catch (e) {
            console.log(e)
        }
    }


    /**
     * 主播类
     */
    class HostUser {
        constructor(roomId, name) {
            this.roomId = roomId;
            this.name = name;
        }
    }


    /**
     * 直播插件，要求所有直播插件继承该类，并实现要求重写的方法！
     */
    class LivePlugin {
        constructor() {
            // 存放内容信息
            this.key = 'key'
            // 存放背景图
            this.bg_key = 'bg_key'
            // 是否显示背景key
            this.bg_show_key = 'bg_show_key'
            // 是否显示菜单
            this.menu_show_key = 'menu_show_key'
            // 直播源
            this.baseUrl = "baseUrl"
            // 默认背景图
            this.defaultBackgroundImage = 'defaultBackgroundImage'
            // 存放屏蔽主播信息
            this.users = []
            // body
            this.html = null
            // body
            this.body = null
            // 菜单
            this.menu = null
            // 操作数据
            this.tbody = null
            // 操作容器
            this.m_container = null
        }

        // 初始化操作方法，子类可以继承该类，实现该类中空方法，参考此操作,初始化构造器实调用该方法就可以了。。。
        init() {
            if (!this.removeRoom()) {
                this.detail()
                this.common()
                this.index()
                this.category()
                this.create_container()
            }
            // 设置壁纸
            this.settingBackgroundImage()
            // 设置菜单
            this.loadLeftMenu()
        }


        /*********************************建议下面操作方法必须重写的,并且参考此步骤*****************************/

        // 公共部分页面操作
        common() {}
        //首页操作
        index() {}
        // 分类页面操作
        category() {}
        // 详情页操作
        detail() {}
        // 通过点击直播间名称删除直播间
        removeRoomByClickRoomName() {}
        // 通过房间号获取直播间name
        getNameByRoomId(roomId) {
            alert('该操作未实现！');
            return null
        }
        // 通过房间地址获取房间号
        getRoomIdByUrl(url) {
            return null
        }

        /*********************************下面方法不建议重写******************************/


        /**
         * 容器，所有操作容器均在此容器中，
         */
        create_container() {
            // 初始化房间号
            let that = this
            if (!that.body || !that.html) {
                that.html = wd.querySelector('html')
                that.body = wd.querySelector('body')
            }
            if (!that.body) {
                that.body = wd.createElement('body')
            }
            that.users = that.getLocalStore(that.key, Array.name)
            let show1 = that.getLocalStore(that.bg_key, Boolean.name)
            let show2 = that.getLocalStore(that.menu_show_key, Boolean.name)
            that.m_container = that.s2d(`
                             <div class="m-container">
                             <div class="operation">
                                  <input type="text" placeholder="房间号...">
                                   <button class="btn btn-success search-room">搜索</button>
                                   <button class="btn btn-teal add-room">添加</button>
                                   <button class="btn btn-info flush-room">刷新</button>
                                   <button class="btn btn-danger clear-room">重置</button>
                                   <button class="btn btn-success bg-btn">上传</button>
                                   <input type="checkbox" id="checkbox1" checked=${show1} class="checkbox"/>背景
                                   <input type="checkbox" id="checkbox2" checked=${show2} class="checkbox"/>菜单
                                   <a class="m-link" href="https://greasyfork.org/zh-CN/scripts/449261-%E8%99%8E%E7%89%99%E7%9B%B4%E6%92%AD" target="_blank" title="更新、反馈">更新</a>
                               </div>
                              <table >
                                   <thead>
                                     <th>序号</th>
                                     <th>名称</th>
                                     <th>房间号</th>
                                     <th>操作</th>
                                   </thead>
                                   <tbody>
                                   </tbody>
                               </table>
                             </div>
         `)



            that.body.appendChild(that.m_container)
            that.tbody = that.m_container.querySelector('.m-container table tbody')
            // 生成操作按钮
            that.operationDOMButton()
            // 添加直播房间号信息
            that.createRoomItem(that.users)
            // 右侧点击添加button
            that.createButton()

        }


        /**
         * 通过用户列表构建列表
         * @param {Object} arr  用户列表
         */
        createRoomItem(arr) {
            if (!Array.isArray(arr)) {
                return;
            }
            let that = this
            arr.forEach((item, index) => {
                let tr = wd.createElement('tr')
                tr.style.borderBottom = '1px solid rgba(0,0,0,0.4)'
                tr.style.margin = '10px 0'
                tr.style.padding = '20px 10px'
                tr.innerHTML =
                    `<td style="padding:10px;">${index+1}</td>
                          <td style="padding:10px;">${item.name}</td>
                          <td style="padding:10px;">${item.roomId}</td>
                          <td style="padding:10px;">
                          <button class="btn btn-danger" room-id="${item.roomId}">删除</button></td>`
                that.tbody.appendChild(tr)
                // 添加删除事件
                const deleteBtn = tr.querySelector('button')
                deleteBtn.addEventListener('click', function(e) {
                    let roomId = e.target.getAttribute('room-id');
                    that.userDelete(roomId)
                    // 如果是当前主播，需要刷新
                    if (that.getRoomIdByUrl(local_url) == roomId) {
                        window.location.reload()
                    }
                    that.removeDOM(tr)
                })

            })
            log('create room itme data success ……')
        }


        /**
         * 解析DOM字符串
         * @param {Object} string DOM文档树
         */
        s2d(string) {
            return new DOMParser().parseFromString(string, 'text/html').body.childNodes[0]
        }


        /**
         * 绘制表格
         * @param {Object} arr 表格数据
         */
        resetTbody(arr) {
            // 删除原来dom
            this.removeDOM(this.tbody, true)
            let table = this.m_container.querySelector('.m-container table')
            this.tbody = wd.createElement('tbody')
            let thead = wd.createElement('thead')
            let room_index = wd.createElement('th')
            let room_name = wd.createElement('th')
            let room_id = wd.createElement('th')
            let room_operation = wd.createElement('th')
            thead.appendChild(room_index)
            thead.appendChild(room_name)
            thead.appendChild(room_id)
            thead.appendChild(room_operation)
            table.appendChild(this.tbody)
            // 添加操作窗口
            this.createRoomItem(arr)

        }


        /**
         * 操作框容器
         */
        operationDOMButton() {
            let that = this
            if (!that.m_container) {
                return;
            }
            const inputValue = that.m_container.querySelector('.m-container .operation input')
            if (inputValue) {
                // 输入框
                inputValue.addEventListener('keyup', function(e) {
                    if (e.key == 'Enter') {
                        let arr = that.users.filter(item => {
                            return (item.roomId && item.roomId.indexOf(inputValue.value) != -
                                1) || (item.name && item.name.indexOf(inputValue.value) != -1)
                        })
                        that.resetTbody(arr)
                    }
                })
            }

            // 添加
            const addRoomBtn = that.m_container.querySelector('.m-container .operation  button.add-room')
            if (addRoomBtn) {
                addRoomBtn.addEventListener('click', function() {
                    const keywords = inputValue.value.trim()
                    if (!keywords) {
                        return alert('请输入房间号！')
                    }
                    if (!that.userIsExist(keywords)) {
                        const name = that.getNameByRoomId(keywords)
                        if (name) {
                            that.addUser(keywords, name)
                            inputValue.value = ''
                        } else {
                            if (confirm(`房间号为${keywords}的主播不存在！确定添加？`)) {
                                that.addUser(keywords, keywords)
                                inputValue.value = ''
                            }
                        }

                    } else {
                        alert('该主播已添加！')
                    }
                })

            }

            // 刷新
            const flushRoomBtn = that.m_container.querySelector('.m-container button.flush-room')
            if (flushRoomBtn) {
                flushRoomBtn.addEventListener('click', function() {
                    that.users = that.getLocalStore()
                    that.resetTbody(that.users)
                })
            }


            // 搜索
            const searchRoomBtn = that.m_container.querySelector('.m-container .operation .search-room')
            if (searchRoomBtn) {
                searchRoomBtn.addEventListener('click', function() {
                    let arr = that.users.filter(item => {
                        return (item.roomId && item.roomId.indexOf(inputValue.value) != -1) || (
                            item.name && item.name.indexOf(inputValue.value) != -1)
                    })
                    that.resetTbody(arr)
                })
            }

            // 清空
            const clearRoomBtn = that.m_container.querySelector('.m-container button.clear-room')
            if (clearRoomBtn) {
                clearRoomBtn.addEventListener('click', function() {
                    if (confirm('确认重置？')) {
                        that.users = []
                        wls.removeItem(that.key)
                        wls.removeItem(that.bg_key)
                        wls.removeItem(that.menu_show_key)
                        that.resetTbody(that.users)
                        window.location.reload()
                    }
                })
            }
            // 设置背景
            const bgBtn = that.m_container.querySelector('.m-container button.bg-btn')
            if (bgBtn) {
                bgBtn.addEventListener('click', function() {
                    let result = prompt('请输入背景图地址')
                    if (!result) {
                        return;
                    }
                    if (!that.isImageUrl(result)) {
                        return alert('请输入一个图片地址');
                    }
                    fetch(result).then(res => {
                        if (res && res.status && res.status == 200) {
                            that.addLocalStore(that.bg_key, result, String.name, false)
                            that.settingBackgroundImage(result)
                        } else {
                            alert('图片资源访问失败，可能存在跨域问题，请更换一张地址!')
                        }
                    }).catch(e => {
                        alert('图片资源访问失败，可能存在跨域问题，请更换一张地址!')
                    })


                })
            }

            // 选择背景
            const checkbox = that.m_container.querySelector('.m-container #checkbox1')
            if (checkbox) {
                checkbox.addEventListener('change', function(e) {
                    that.addLocalStore(that.bg_show_key, e.target.checked, Boolean.name)
                    that.settingBackgroundImage()
                })
            }
            // 是否关闭菜单
            const menu = that.m_container.querySelector('.m-container #checkbox2')
            if (menu) {
                menu.addEventListener('change', function(e) {
                    that.getLeftMenu(e.target.checked)
                })
            }


        }

        /**
         * 右侧操作按钮
         * @param text 指定按钮文本，默认是小虎牙或者是小鱼丸
         */
        createButton(text) {
            let that = this
            if (!that.body) {
                return;
            }
            const btn = wd.createElement('button')
            btn.style.cursor = 'pointer'
            btn.style.position = 'fixed'
            btn.style.top = '300px'
            btn.style.right = '0px'
            btn.style.padding = '5px 10px'
            btn.style.backgroundColor = 'rgb(255, 93, 35)'
            btn.style.border = 'none'
            btn.style.borderRadius = '20px'
            btn.style.fontSize = '12px'
            btn.style.color = '#fff'
            btn.style.zIndex = 100000
            btn.textContent = text ? text : (is_huya ? '小虎牙' : '小鱼丸')
            btn.addEventListener('click', function(e) {
                if (that.m_container.style.display === 'block') {
                    that.m_container.style.display = 'none'
                } else {
                    that.m_container.style.display = 'block'
                }
            })
            btn.addEventListener('mouseenter', function() {
                btn.style.backgroundColor = 'rgba(255, 93, 35,0.6)'
            })
            btn.addEventListener('mouseleave', function() {
                btn.style.backgroundColor = 'rgba(255, 93, 35,1)'
            })
            that.body.appendChild(btn)

        }


        /**
         * 删除DOM
         * @param element 需要删除的元素
         * @param realRemove 是否真实删除，默认不删除
         */
        removeDOM(element, realRemove = false) {
            try {
                if (element) {
                    element.style.display = 'none'
                    if (realRemove) {
                        element.remove()
                    }
                }
            } catch (e) {} // 防止element没有remove方法而抛出异常
        }

        /**
         * 删除DOM
         * @param selector 选择器
         * @param realRemove 是否真实删除，默认不删除
         *
         */
        removeElement(selector, realRemove = false) {
            this.removeDOM(wd.querySelector(selector), realRemove)
        }




        /**
         * 该房间是否已改被删除
         * @param url 房间链接地址 默认 window.location.href
         */
        removeRoom(url = local_url) {
            if (!this.isRemove(url)) {
                return false
            }
            this.roomIsNeedRemove();
            return true
        }


        /**
         * 房间已被删除之后操作
         * @param url 房间链接地址 默认 window.location.href
         */
        roomAlreadyRemove() {
            this.removeDOM(this.body, true)
            this.body = null; //必须设置为空！否则无法设置新的button
            const h2 = wd.createElement('h2')
            let html = wd.querySelector('html')
            let body = wd.querySelector('body')
            if (!body) { // 如果原来的删除了，从新创建一个body存放内容
                body = wd.createElement('body')
            }
            body.style.display = 'flex'
            body.style.justifyContent = 'center'
            body.style.alignItems = 'center'
            // 获取主播名称
            let name = this.getUser(this.getRoomIdByUrl(local_url)) ? this.getUser(this.getRoomIdByUrl(
                local_url)).name : ''
            h2.textContent = `主播【${name}】已被你屏蔽`
            h2.style.fontSize = '40px'

            let title = wd.querySelector('title')
            if (!title) {
                title = wd.createElement('title')
            }
            title.textContent = `主播【${name}】已被你屏蔽`
            html.appendChild(body)
            body.appendChild(h2)
            this.removeDOM(this.m_container, true)
            this.m_container = null
            // 创建操作面板
            this.create_container()
        }

        /**
         * 判断链接是否应该被删除
         * @param href 房间链接地址 默认 window.location.href
         */
        isRemove(href) {
            return this.userIsExist(this.getRoomIdByUrl(href));
        }


        /**
         * 设置背景图
         * @param url 背景图地址 默认 是默认地址
         */
        settingBackgroundImage(url) {
            if (this.getLocalStore(this.bg_show_key, Boolean.name)) {
                if (!url) {
                    url = this.getImageUrl(url)
                }
                this.body.style.backgroundSize = "cover"
                this.body.style.backgroundRepeat = 'no-repeat'
                this.body.style.backgroundAttachment = 'fixed'
                this.body.style.backgroundImage = `url(${url})`
            } else {
                this.body.style.backgroundImage = 'none'
            }

        }

        /**
         * 获取本地图片地址
         * @param url 背景图地址 默认 是默认地址
         */
        getImageUrl(url) {
            if (!url) {
                url = wls.getItem(this.bg_key)
            }
            return this.isImageUrl(url) ? url : this.defaultBackgroundImage;
        }

        /**
         * 是否是一张图片地址
         * @param url 背景图地址 默认当前壁纸
         */
        isImageUrl(url) {
            return bg_regx.test(url)
        }

        /**
         * 通过房间名称或者id判断房间是否已经保存到本地
         * @param keywords 房间名或者id
         * @param list 本地缓存数据，默认是本地缓存用户数据
         */
        userIsExist(keywords, list = this.users) {
            return this.getUser(keywords, list) ? true : false
        }


        /**
         * 通过房间名称或者id判断房间是否已经保存到本地
         * @param keywords 房间名或者id
         * @param list 本地缓存数据，默认是本地缓存用户数据
         */
        getUser(keywords, list = this.users) {
            for (let i = 0; i < list.length; i++) {
                if ((list[i].name && list[i].name == keywords) || (list[i].roomId && list[i].roomId ==
                    keywords)) {
                    return list[i]
                }
            }
            return null
        }



        /**
         * 通过房间id或者房间名删除本地缓存的数据
         * @param keywords 房间名或者id
         */
        userDelete(keywords) {
            let that = this
            that.users.forEach((item, index) => {
                if (keywords == item.name || keywords == item.roomId) {
                    that.users.splice(index, 1)
                }
            })
            that.addLocalStore(this.key, this.users)
        }


        /**
         * 添加并保存直播间
         * @param id, 房间id
         * @param name 房间名
         */
        addUser(id, name) {
            if (this.userIsExist(id) || this.userIsExist(name)) {
                alert('该房间已存在！')
                return;
            }
            const newUser = new HostUser(id, name);
            // 添加
            this.users.unshift(newUser)
            // 保存到本地
            this.addLocalStore(this.key, this.users)
            this.resetTbody(this.users)
            // 如果是当前主播需要屏蔽
            if (id == this.getRoomIdByUrl(local_url)) {
                this.roomIsNeedRemove(local_url);
            }

        }

        /**
         *  获取本地保存的直播数据
         *  @param {defaultKey}  = [存储key]
         *  @param {obj}  = [需要存储的value]
         *  @param {type}  = [要解析参数类型]
         *  @param {isparse}  = [是否需要解析]
         */
        addLocalStore(defaultKey = this.key, obj = this.users, type = Array.name, isParse = true) {
            console.log(defaultKey, JSON.stringify(obj))
            try {
                if (type == Object.name || type == Array.name) {
                    if (isParse) {
                        window.localStorage.setItem(defaultKey, JSON.stringify(obj))
                    } else {
                        window.localStorage.setItem(defaultKey, obj)
                    }
                }

                if (type == String.name || type == Boolean.name) {
                    window.localStorage.setItem(defaultKey, obj)
                }
            } catch (e) {
                console.log(e)
            }

        }


        /**
         * 获取本地保存的直播数据
         *  @param {key}  = [存储key]
         *  @param {type}  = [要解析参数类型]
         *  @param {isparse}  = [是否需要解析]
         */
        getLocalStore(k = this.key, type = Array.name, isParse = true) {
            let obj = window.localStorage.getItem(k)
            if (type == Array.name) {
                if (isParse) {
                    try {
                        if (obj) {
                            obj = JSON.parse(obj)
                        } else {
                            obj = []
                        }

                    } catch (e) {
                        //TODO handle the exception
                        obj = []
                        log(e, 'error')
                    }

                }
                return Array.isArray(obj) ? obj : []
            }

            if (type == Object.name) {
                if (isParse) {
                    try {
                        if (obj) {
                            obj = JSON.parse(obj)
                        } else {
                            obj = {}
                        }

                    } catch (e) {
                        obj = {}
                    }

                }
                return obj ? obj : {}
            }

            if (type == String.name) {
                return obj ? obj : '';
            }

            if (type == Boolean.name) {
                return (obj == 'true' || obj == true) ? true : false;
            }

            return obj;

        }


        /**
         * @param {selector}  = 选择器
         * @param {selector}  = [是否真的删除，默认删除而不是display = 'none']
         * @param {time1} 循环执行时间 默认5000ms
         */
        removeVideo(selector, realyRemove = true, time1 = 5000) {
            // 第一次执行该操作
            try {
                const video = wd.querySelector(selector)
                if (video) {
                    video.pause()
                }
                this.removeDOM(video, realyRemove)
            } catch (e) {}
            // 循环执行该操作
            setInterval(() => {
                try {
                    const video = wd.querySelector(selector)
                    if (video) {
                        video.pause()
                    }
                    this.removeDOM(video, realyRemove)
                } catch (e) {}
            }, time1)
        }


        /**
         * @param {selector}  = [选择器]
         * @param {selector}  = [是否真的删除，默认删除而不是display = 'none']
         */
        roomIsNeedRemove(selector = wd.querySelector('video'), realyRemove = true) {
            // 移除直播间视频
            this.removeVideo(selector, true)
            // 添加直播间删除禁言提示
            this.roomAlreadyRemove()
        }

        /*
         * 操作左侧导航栏，需要传入选择器，和修改值 建议放到公共方法下执行！
         * @param {selector}  = [选择器]
         * @param {value}  = [要修改的值]
         */
        getLeftMenu(value = false) {
            if (!this.menu) {
                return alert('获取不到导航菜单，操作失败！')
            }
            if (value) {
                this.menu.style.display = 'block';
            } else {
                this.menu.style.display = 'none'
            }
            this.addLocalStore(this.menu_show_key, value, Boolean.name, false)

        }

        /*
         * 操作左侧导航栏，需要传入选择器，和修改值 建议放到公共方法下执行！
         * @param {selector}  = [选择器]
         */
        loadLeftMenu() {
            //首次加载是否显示
            let d_show = this.getLocalStore(this.menu_show_key, Boolean.name, false)
            if (this.menu) {
                if (d_show) {
                    this.menu.style.display = 'block';
                } else {
                    this.menu.style.display = 'none';
                }
            }
        }

    }

    /**
     * 虎牙直播插件
     */
    class TriggerLive extends LivePlugin {
        constructor() {
            super()
            this.key = 'huyazhibo'
            this.bg_key = 'huyazhibo_bg'
            this.bg_show_key = 'huyazhibo_bg_show'
            this.menu_show_key = 'huyazhibo_menu_show_key'
            this.defaultBackgroundImage = 'https://livewebbs2.msstatic.com/huya_1664197944_content.jpg'
            this.baseUrl = "https://www.huya.com/"
            this.users = this.getLocalStore(this.key, Array.name, true)
            this.html = wd.querySelector('html')
            this.body = wd.querySelector('body')
            this.menu = wd.querySelector('.mod-sidebar')
            this.tbody = null
            this.m_container = null
            // 初始化，请务必调用该方法！！！
            this.init()
        }


        // 首页操作
        index() {
            // 直播源
            const url = local_url
            if (url == this.baseUrl) {
                // 操作视频
                this.removeVideo('.mod-index-main video', true)
                // 触发点击关闭广告
                const banner_close = wd.querySelector('.mod-index-wrap #banner i')
                if (banner_close) {
                    banner_close.click();
                }

            }

        }
        // 分类页操作
        category() {
            if (new RegExp(/^https:\/\/.*\.huya\.((com)|(cn))\/g(\/.*)$/).test(local_url)) {
                let that = this
                const dd = wd.querySelectorAll('.live-list-nav dd')
                if (dd) {
                    for (let d of dd) {
                        d.addEventListener('click', () => {
                            setTimeout(() => {
                                that.removeRoomByClickRoomName()
                            }, 2000)

                        })

                    }
                }
            }
        }
        // 公共部分操作
        common() {
            this.removeRoomByClickRoomName()
        }
        // 详情操作
        detail() {
            if (new RegExp(/^https:\/\/www\.huya\.com(\/\w+)$/).test(local_url)) {
                let that = this
                // 点击直播间移除直播间操作
                const hostName = wd.querySelector('.host-name')
                if (hostName) {
                    hostName.addEventListener('click', () => {
                        if (confirm(`确认禁用 ${hostName.textContent}？`)) {
                            that.addUser(that.getRoomIdByUrl(local_url), hostName.textContent)
                        }
                    })

                }
            }
        }
        // 通过地址获取房间号
        getRoomIdByUrl = (url = local_url) => {
            let arr = url.split('/')
            let roomId = arr[arr.length - 1]
            return roomId
        }

        // 通过房间号查找名称
        getNameByRoomId(roomId) {
            let that = this
            const hostName = document.querySelector('.host-name')
            if (!hostName) {
                const rooms = document.querySelectorAll('.game-live-item')
                if (rooms) {
                    for (let room of rooms) {
                        const a = room.querySelector('a')
                        if (a && a.href) {
                            const id = that.getRoomIdByUrl(a.href)
                            const user = room.querySelector('.txt i')
                            if (id === roomId) {
                                hostName = user
                            }
                        }

                    }
                }
            }
            return hostName && hostName.textContent ? hostName.textContent : ''
        }

        // 通过点击直播间名称删除直播间
        removeRoomByClickRoomName() {
            const that = this
            const rooms = document.querySelectorAll('.game-live-item')
            if (rooms) {
                for (let li of rooms) {
                    try {
                        const a = li.querySelector('a')
                        // 获取单个主播间房间地址
                        const url = a.href
                        // 获取房间i
                        const user = li.querySelector('.txt i')
                        const name = user.textContent || ''
                        user.addEventListener('click', () => {
                            if (confirm(`确认禁用 ${name}？`)) {
                                that.addUser(that.getRoomIdByUrl(url), name);
                                that.removeDOM(li);
                            }
                        })
                        if (that.isRemove(url)) {
                            that.removeDOM(li)
                        }
                    } catch (e) {}

                }
            }

        }

    }

    /**
     * 斗鱼直播插件
     */
    class FishLive extends LivePlugin {
        constructor() {
            super()
            this.key = 'douyuzhibo'
            this.bg_key = 'douyuzhibo_bg'
            this.bg_show_key = 'douyuzhibo_show'
            this.menu_show_key = 'douyuzhibo_menu_show_key'
            this.baseUrl = "https://www.douyu.com/"
            this.defaultBackgroundImage =
                'https://sta-op.douyucdn.cn/dylamr/2022/11/07/1e10382d9a430b4a04245e5427e892c8.jpg'
            this.users = this.getLocalStore(this.key, Array.name, true)
            this.html = wd.querySelector('html')
            this.body = wd.querySelector('body')
            this.menu = wd.querySelector('#js-aside')
            this.tbody = null
            this.m_container = null
            // 初始化，请务必调用该方法！！！
            this.init()
        }


        // 公共部分页面操作
        common() {
            let that = this
            const videos = wd.querySelectorAll('video')
            if (videos) {
                for (let video of videos) {
                    // video.pause()
                }
            }

        }
        //首页操作
        index() {
            let that = this
            // 直播源
            if (window.location.href == that.baseUrl) {
                window.scroll(0, 0)
                // 移除直播
                that.removeVideo('.layout-Slide-player video', true)
                // 获取暂停button
                const vbox = wd.querySelector('#room-html5-player');
                const divs = vbox.querySelectorAll('div')
                if (divs) {
                    divs.forEach(div => {
                        if (div && div.title && div.title == '暂停') {
                            div.click()
                        }
                    })

                }
                // 初始化默认高度，默认浏览器可视化高度
                let init = window.innerHeight;
                // 初始化容器存放用户
                let init_users = []
                // 页面加载完毕
                setTimeout(() => {
                    that.removeRoomByClickRoomName(init_users)
                }, time)
                // 斗鱼直播使用懒加载方式,只有鼠标下滑,下方直播间才会加载,首次加载不会加载所有页面直播间列表
                // 因此,添加滚动事件来添加
                // 另外防止二次或者多次添加点击事件,将之前保存到init_users中来记录是否该添加
                window.addEventListener('scroll', (e) => {
                    // 超过可视化高度，需要重新加载
                    if (window.pageYOffset > init) {
                        init = init + 100;
                        // 重新扫描点击事件
                        that.removeRoomByClickRoomName(init_users)
                    }

                })

            }
        }
        // 分类页面操作
        category() {
            let that = this
            // 匹配分类页
            if (new RegExp(/https:\/\/www.douyu.com(\/((directory.*)|(g_.*)))$/).test(window.location.href)) {
                that.removeRoomByClickRoomName()
                const labels = wd.querySelectorAll('.layout-Module-filter .layout-Module-label')
                if (labels) {
                    for (let label of labels) {
                        if (label) {
                            label.addEventListener('click', (e) => {
                                e.preventDefault()
                                // 获取当前地址
                                let to_link = label && label.href ? label.href : null
                                if (to_link) {
                                    window.location.href = to_link
                                } else {
                                    // 获取全部地址
                                    var result = 'https://www.douyu.com/g_' + local_url.match(RegExp(
                                        /subCate\/.*/g))[0].replace('subCate', '').match(new RegExp(
                                        /\w+/g))[0]
                                    window.location.href = result
                                }

                            })

                        }

                    }
                }

            }


        }
        // 详情页操作
        detail() {
            let that = this
            // 匹配只有在播放直播间才会生效
            if (new RegExp(/^https:.*.douyu\.com(\/((.*rid=\d+)|(\d+)))$/).test(local_url)) {
                // 详情页名称操作
                setTimeout(() => {
                    // 点击主播直播间名称进行操作
                    const hostName = wd.querySelector('.Title-roomInfo h2.Title-anchorNameH2')
                    if (hostName) {
                        hostName.addEventListener('click', () => {
                            if (confirm(`确认禁用 ${hostName.textContent}？`)) {
                                that.addUser(that.getRoomIdByUrl(local_url), hostName
                                    .textContent)
                            }
                        })

                    }

                    // 删除直播间背景图
                    const divs = wd.querySelectorAll('#root div')
                    // 删除直播间背景图
                    if (divs) {
                        for (let d of divs) {
                            // 正则查找所有不包含video的背景 div标签
                            if (d && d.id && new RegExp(/^bc.*$/g).test(d.id)) {
                                if (d.querySelector('video')) {
                                    d.style.background = 'none'
                                } else {
                                    that.removeDOM(d, false)
                                }
                            }
                        }
                    }

                    // 删除根标签下非video的标签
                    const divs2 = wd.querySelectorAll('#root div.wm-general')
                    if (divs2) {
                        for (let d of divs2) {
                            if (d.querySelector('video')) {
                                //to do
                                d.style.background = 'none'
                            } else {
                                that.removeDOM(d, false)
                            }

                        }
                    }

                    const player = wd.querySelector('#root div.layout-Main')
                    if (player) {
                        player.style.marginTop = '70px';
                    }

                }, time)
            }

        }
        // 通过点击直播间名称删除直播间
        removeRoomByClickRoomName(list = []) {
            let that = this
            if (this.baseUrl == local_url) {
                const room = wd.querySelectorAll('.layout-Wrapper.layout-Module.RoomList .layout-List-item')
                if (room) {
                    for (let li of room) {
                        try {
                            // 获取单个主播间房间地址
                            const a = li.querySelector('a')
                            if (a) {
                                a.onclick = (e) => {
                                    e.preventDefault()
                                }
                                const url = a.href
                                const user = li.querySelector('.DyCover-user')
                                const name = user.textContent || ''
                                if (user && (!that.userIsExist(name, list) || !that.userIsExist(
                                        url, list))) {
                                    // 添加记录,下次不再添加！！！
                                    list.unshift(new HostUser(url, name))
                                    user.addEventListener('click', () => {
                                        if (confirm(`确认禁用 ${name}`)) {
                                            that.addUser(that.getRoomIdByUrl(url), name);
                                            that.removeDOM(li);
                                        }
                                    }, true)
                                    log(new HostUser(url, name))
                                }

                                if (that.isRemove(url) || that.userIsExist(name)) {
                                    that.removeDOM(li)
                                }

                            }

                        } catch (e) {}

                    }
                }
            }

            if (new RegExp(/https:\/\/www.douyu.com(\/((directory.*)|(g_.*)))$/).test(local_url)) {
                const rooms = wd.querySelectorAll('.layout-Cover-item')
                if (rooms) {
                    for (let li of rooms) {
                        try {
                            if (li) {
                                const link = li.querySelector('a.DyListCover-wrap')
                                if (link) {
                                    link.addEventListener('click', (e) => {
                                        e.preventDefault()
                                    })
                                    const url = link.href
                                    const user = link.querySelector('div.DyListCover-userName')
                                    const name = user.textContent || ''

                                    // 判断该直播间列表窗口是否需要删除
                                    if (that.isRemove(url) || that.userIsExist(name)) {
                                        that.removeDOM(li, true)
                                    } else {
                                        if (user) {
                                            user.addEventListener('click', (e) => {
                                                if (confirm(`确认禁用 ${name}？`)) {
                                                    const id = that.getRoomIdByUrl(url);
                                                    that.addUser(id, name);
                                                    that.removeDOM(li);
                                                }
                                                e.preventDefault()
                                            })
                                        }


                                        // 监听鼠标移入事件
                                        li.addEventListener('mouseenter', (e) => {
                                            e.preventDefault()
                                            const a = e.target.querySelector(
                                                'a.DyListCover-wrap.is-hover')
                                            if (a) {
                                                const url = a.href
                                                const user = a.querySelector('.DyListCover-userName')
                                                const name = user.textContent || ''
                                                if (user) {
                                                    user.addEventListener('click', (a) => {
                                                        a.preventDefault()
                                                        if (confirm(`确认禁用 ${name}？`)) {
                                                            const id = that.getRoomIdByUrl(url);
                                                            that.addUser(id, name);
                                                            that.removeDOM(li);
                                                        }

                                                    })
                                                }

                                                a.addEventListener('click', (t) => {
                                                    t.preventDefault()
                                                })

                                            }


                                        })
                                    }

                                }
                            }

                        } catch (e) {}
                    }
                }

            }

        }
        // 通过房间号获取直播间name
        getNameByRoomId(keywords) {
            let that = this
            // 从详情页获取
            const hostName = document.querySelector('.Title-blockInline .Title-anchorName h2')
            let rooms = null;
            if (!hostName) {
                rooms = document.querySelectorAll('.layout-List-item')
                // index
                if (rooms) {
                    for (let room of rooms) {
                        const id = that.getRoomIdByUrl(room.querySelector('a').href)
                        const user = room.querySelector('.DyCover-user')
                        if (id == keywords) {
                            hostName = user
                        }
                    }
                }
                // 如果还是获取不到从分类页面获取
                if (!hostName) {
                    rooms = document.querySelectorAll('.layout-Cover-item')
                    if (rooms) {
                        for (let room of rooms) {
                            const id = that.getRoomIdByUrl(room.querySelector('a').href)
                            const user = room.querySelector('.DyListCover-userName')
                            if (id == keywords) {
                                hostName = user
                            }
                        }
                    }
                }


            }
            return hostName && hostName.textContent ? hostName.textContent : ''
        }
        // 通过房间地址获取房间号
        getRoomIdByUrl(url) {
            try {
                if (new RegExp(/https:\/\/.*(rid=.*)$/).test(local_url)) {
                    return local_url.match(new RegExp(/rid=.*/g))[0].replace('rid=', '')
                } else {
                    let arr = url.split('/')
                    let roomId = arr[arr.length - 1]
                    return roomId
                }

            } catch (e) {
                return null
            }
        }

    }


    // 样式部分
    GM_addStyle(`
    .m-container {
         box-sizing: border-box;
         position: fixed;
         display: none;
         width: 550px;
         height: 400px;
         top: 100px;
         left: 50%;
         border-radius: 0;
         overflow: hidden scroll;
         background-color: white;
         transform: translateX(-50%);
         z-index:1000;
         transition: display linear 1s;
         box-shadow: 2px 2px 2px rgba(0, 0, 0, 0.2),
         -2px -2px 2px rgba(0, 0, 0, 0.2);
       }
       .m-container .operation {
         box-sizing: border-box;
         height: 80px;
         padding: 20px 0 0 0;
         text-align: center;
       }
        .m-container .operation input[type="text"] {
         width:100px;
         box-sizing: border-box;
         outline: none;
         border: 1px solid teal;
         padding: 5px;
       }
       .m-container .operation input[type="text"]:focus {
         border: 2px solid teal;
       }
       .m-container .operation input[type="checkbox"] {
         display:inline;
       }
       .m-container table {
         position: relative;
         box-sizing: border-box;
         overflow: hidden;
         padding: 10px;
         text-align: left !important;
         margin: 0 auto;
         max-height:200px;
         width: 90%;
       }
       .m-container  table tbody {
         max-height: 250px;
         text-align: left !important;
       }
       .m-container table thead{
         border-top: 1px solid rgba(0,0,0,0.4);
         border-bottom: 1px solid rgba(0,0,0,0.4);
         text-align: left !important;
         padding: 10px;
       }
       .m-container table th, m-container table td {
         padding: 10px;
       }
       .m-container table tr {
         border-bottom: 1px solid rgba(0,0,0,0.4);
         margin:5px 0;
       }
       .m-container .m-link,.m-container .m-link:visited{
          color:blnk !important;
       }
       .m-container .m-link:hover{
          color:blue !important;
          text-decoration:underline !important;
       }
       .m-container .btn {
         cursor: pointer !important;
         padding: 5px 7px !important;
         border: none !important;
         color: #fff !important;
         font-size:10px !important;
         border-radius:20px !important;
         max-width:50px  !important;
         margin:0 0 !important;;
         z-index:1000 !important;
       }
       .m-container .btn-teal{
         background-color:rgba(0, 128, 64,1)  !important;
       }
      .m-container .btn-teal:hover{
         background-color:rgba(0, 128, 64,0.6) !important;
       }
       .m-container .btn-success{
         background-color: rgba(52, 108, 233,1) !important;
       }
        .m-container .btn-success:hover{
         background-color: rgba(52, 108, 233,0.6) !important;
       }
       .m-container .btn-info{
         background-color:rgba(119, 119, 119,1) !important;
       }
       .m-container .btn-info:hover{
          background-color:rgba(119, 119, 119,0.6) !important;
       }
       .m-container .btn-danger{
         background-color:rgba(255, 0, 0,1) !important;
       }
        .m-container .btn-danger:hover{
         background-color:rgba(255, 0, 0,0.6) !important;
       }
       .game-live-item i,.host-name {
           cursor:pointer;
       }
       .game-live-item .txt i:hover,.host-name:hover {
           color:rgb(255, 135, 0);
       }
       .layout-List-item .DyCover-content .DyCover-user,.layout-Cover-item .DyListCover-userName,.Title-blockInline .Title-anchorName h2{
           cursor:pointer !important;
       }
       .layout-List-item .DyCover-content .DyCover-user:hover,.layout-Cover-item .DyListCover-userName:hover,.Title-blockInline .Title-anchorName h2:hover {
           color:rgb(255, 135, 0) !important;
        }
        /********************斗鱼直播********************************/
      .layout-Section.layout-Slide .layout-Slide-player,
      .layout-Slide-bannerInner,
       #lazyModule3,
       #lazyModule4,
       #lazyModule5,
       #lazyModule6,
       #lazyModule7,
       #lazyModule8,
       #lazyModule23,
       #lazyModule24,
       #js-room-activity,
       #js-right-nav,
       #js-bottom,
       #js-header .Header .HeaderNav,
       #js-header .Header .HeaderGif-left,
       #js-header .Header .HeaderGif-right,
       #js-room-activity,
       #js-right-nav,
       #js-bottom,
       li.Header-menu-link,
       .layout-Main .layout-Customize,
       .HeaderCell-label-wrap,
       .Title-AnchorLevel,.RoomVipSysTitle,
       .Aside-nav .Aside-nav-item,
       .Title-roomInfo .Title-row,
       .multiBitRate-da4b60{
           display:none !important;
       }
        li.Header-menu-link:nth-child(1),
        li.Header-menu-link:nth-child(2),
        li.Header-menu-link:nth-child(3),
        .Aside-nav .Aside-nav-item:nth-child(1),
        .Title-roomInfo .Title-row:nth-child(1),
        .Title-roomInfo .Title-row:nth-child(2) {
           display:inline-block !important;
       }
       .Barrage-main  .UserLevel,
       .Barrage-main  .js-user-level,
       .Barrage-main  .Barrage-icon,
       .Barrage-main  .Motor,
       .Barrage-main  .Motor-flag,
       .Barrage-main  .Barrage-hiIcon,
       .Barrage-main  .UserGameDataMedal,
       .Barrage-main  .ChatAchievement,
       .Barrage-main  .Barrage-notice,
       .layout-Player .layout-Player-announce,
       .layout-Player .layout-Player-rank,
        #js-player-toolbar,
       .MatchSystemTeamMedal,
       .Barrage .Barrage-userEnter{
         display:none !important;
       }
       #root div.layout-Main{
           margin-top:70px !important;
       }

       .Barrage-main .Barrage-content {
        color:#333 !important;
       }
       .Barrage-main .Barrage-nickName{
        color:#2b94ff !important;
       }

       .Barrage-listItem{
         color: #333 !important;
         background-color: #f2f5f6 !important;
       }

       .layout-Player-barrage{
           position: absolute !important;
           top: 0 !important;
        }

        body{
         max-width:100vw !important;
        }

       /********************虎牙直播********************************/
       .helperbar-root--12hgWk_4zOxrdJ73vtf1YI,
       .mod-index-wrap .mod-index-main .main-bd,
       .mod-index-wrap .mod-index-main .main-hd,
       .mod-index-wrap #js-main,
       .mod-index-wrap #banner,
       .mod-index-wrap .mod-game-type,
       .mod-index-wrap .mod-actlist,
       .mod-index-wrap .mod-news-section,
       .mod-index-wrap .mod-index-list .live-box #J_adBnM,
       .mod-index-wrap .mod-index-recommend,
       .mod-index-wrap .mod-news-section,
       .mod-index-wrap .recommend-wrap,
       .liveList-header-r,
       .room-footer,
       .J_roomSideHd,
        #J_roomSideHd,
        #player-gift-wrap,
        #match-cms-content,
        #matchComponent2,
       .hy-nav-item,
       .list-adx,
       .room-weeklyRankList{
           display:none !important;
        }
        .hy-nav-item:nth-child(1),
        .hy-nav-item:nth-child(2),
        .hy-nav-item:nth-child(3)
        {
          display:inline-block !important;
        }
        .mod-index-wrap .mod-index-list{
          margin-top:80px !important;
        }
        .duya-header{
          background: hsla(0,0%,100%,.95)  !important;
          border-bottom: 1px solid #e2e2e2 !important;
          box-shadow: 0 0 6px rgb(0 0 0 / 6%) !important;
        }
        .duya-header a,.duya-header i{
         color:#000 !important;
        }
       .chat-room__list .msg-normal,.chat-room__list .msg-bubble{
          background:none !important;
        }
       .chat-room__list .msg-normal-decorationPrefix,
       .chat-room__list .msg-normal-decorationSuffix,
       .chat-room__list .msg-bubble-decorationPrefix,
       .chat-room__list img,
       .chat-room__list .msg-noble,
       .chat-room__list .msg-sys,
       .chat-room__list .msg-auditorSys,
       .J_box_msgOfKing,
       .chat-room__list .msg-onTVLottery{
           display: none;
        }
       .chat-room__list .msg-bubble span.msg {
           color: #333 !important:
           background:none!important:
         }
       .chat-room__list .msg-bubble .colon,
       .chat-room__list .msg-bubble .msg,
       .chat-room__list .name
        {
           color #3c9cfe !important:
           background:none!important:
         }

 `)

})()
