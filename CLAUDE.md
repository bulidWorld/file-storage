# 项目概述

## 结构规范
src/
├── app/
│   ├── api/           【后台接口文件夹】后端所有代码都在这
│   │   └── user/
│   │       └── route.ts  后台接口接口
│   ├── page.tsx       【前台页面】use client 浏览器运行
│   ├── layout.tsx     根布局
│   └── globals.css    全局样式
├── components/         前台组件
└── utils/             前后台通用工具

## 接口请求规范
请求需要加认证头，参考代码：
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

