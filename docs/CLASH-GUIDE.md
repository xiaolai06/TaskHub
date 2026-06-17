# Clash 配置说明

## 配置文件结构

Clash 配置文件 `config.yaml` 主要包含以下几个部分：

```yaml
# 基础设置
port: 7890          # HTTP 代理端口
socks-port: 7891    # SOCKS5 代理端口
allow-lan: true     # 允许局域网连接
mode: rule          # 模式：rule(规则) / global(全局) / direct(直连)
external-controller: 0.0.0.0:9090  # Web 面板监听地址

# 代理节点（你的订阅会自动填充这部分）
proxies:
  - name: "香港01"
    type: ss
    server: hk01.example.com
    port: 443
    cipher: chacha20-ietf-poly1305
    password: "your_password"

  - name: "日本01"
    type: vmess
    server: jp01.example.com
    port: 443
    uuid: your_uuid
    alterId: 0
    cipher: auto

  - name: "美国01"
    type: trojan
    server: us01.example.com
    port: 443
    password: "your_password"

# 代理组（用于选择和切换节点）
proxy-groups:
  # 手动选择组 - 你手动选择用哪个节点
  - name: "Proxy"
    type: select
    proxies:
      - "香港01"
      - "日本01"
      - "美国01"
      - "自动选择"
      - "DIRECT"

  # 自动选择组 - 自动测试延迟，选最快的
  - name: "自动选择"
    type: url-test
    proxies:
      - "香港01"
      - "日本01"
      - "美国01"
    url: http://www.gstatic.com/generate_204
    interval: 300  # 每300秒测试一次

  # 故障转移组 - 主节点挂了自动切换
  - name: "故障转移"
    type: fallback
    proxies:
      - "香港01"
      - "日本01"
      - "美国01"
    url: http://www.gstatic.com/generate_204
    interval: 300

  # 负载均衡组 - 分散流量到多个节点
  - name: "负载均衡"
    type: load-balance
    proxies:
      - "香港01"
      - "日本01"
      - "美国01"
    url: http://www.gstatic.com/generate_204
    interval: 300

# 规则（决定哪些流量走代理）
rules:
  # 国内网站直连
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
  - DOMAIN-SUFFIX,bilibili.com,DIRECT

  # 国外网站走代理
  - DOMAIN-SUFFIX,google.com,Proxy
  - DOMAIN-SUFFIX,youtube.com,Proxy
  - DOMAIN-SUFFIX,twitter.com,Proxy
  - DOMAIN-SUFFIX,github.com,Proxy

  # Docker Hub 走代理（你需要这个）
  - DOMAIN-SUFFIX,docker.io,Proxy
  - DOMAIN-SUFFIX,docker.com,Proxy

  # 其他规则
  - GEOIP,CN,DIRECT      # 中国 IP 直连
  - MATCH,Proxy           # 其他流量走代理
```

## 代理组类型说明

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| `select` | 手动选择节点 | 日常使用，自己选节点 |
| `url-test` | 自动测速选择最快 | 懒人模式，自动选最优 |
| `fallback` | 故障自动切换 | 需要稳定连接时 |
| `load-balance` | 负载均衡 | 大流量场景 |

## 常用代理协议

| 协议 | 说明 | 特点 |
|------|------|------|
| `ss` | Shadowsocks | 简单快速 |
| `vmess` | V2Ray | 功能强大 |
| `trojan` | Trojan | 伪装 HTTPS |
| `hysteria` | Hysteria | 高速 UDP |

## Web 面板使用

访问 `http://服务器IP:9090/ui` 可以：
- 查看所有节点列表
- 测试节点延迟
- 切换代理组
- 查看实时流量

## 你的订阅链接

订阅链接会自动生成：
- `proxies` - 所有节点
- `proxy-groups` - 代理组
- `rules` - 规则

你只需要：
1. 下载订阅配置
2. 运行 Clash
3. 在 Web 面板选择节点

## 常用命令

```bash
# 查看 Clash 状态
systemctl status clash

# 重启 Clash
systemctl restart clash

# 查看日志
journalctl -u clash -f

# 测试代理
curl -x http://127.0.0.1:7890 https://www.google.com
```
