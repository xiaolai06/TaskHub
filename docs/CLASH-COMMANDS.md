# Clash 服务器管理命令

## 1. 启动/停止/重启

```bash
# 启动
sudo systemctl start clash

# 停止
sudo systemctl stop clash

# 重启
sudo systemctl restart clash

# 查看状态
sudo systemctl status clash

# 查看日志
sudo journalctl -u clash -f
```

## 2. 配置代理环境变量

```bash
# 临时生效（当前终端）
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
export all_proxy=socks5://127.0.0.1:7890

# 永久生效（写入配置文件）
echo 'export http_proxy=http://127.0.0.1:7890' >> ~/.bashrc
echo 'export https_proxy=http://127.0.0.1:7890' >> ~/.bashrc
echo 'export all_proxy=socks5://127.0.0.1:7890' >> ~/.bashrc
source ~/.bashrc

# 取消代理
unset http_proxy https_proxy all_proxy
```

## 3. 测试代理是否生效

```bash
# 测试访问 Google
curl -I https://www.google.com

# 测试访问 Docker Hub
curl -I https://hub.docker.com

# 测试下载速度
curl -x http://127.0.0.1:7890 -o /dev/null -w "Speed: %{speed_download} bytes/sec\n" https://speed.cloudflare.com/__down?bytes=10000000
```

## 4. Web 面板命令

```bash
# 查看面板地址
curl http://127.0.0.1:9090

# 查看所有节点
curl http://127.0.0.1:9090/proxies

# 查看当前使用的节点
curl http://127.0.0.1:9090/proxies/Proxy

# 切换节点（替换 "节点名称"）
curl -X PUT http://127.0.0.1:9090/proxies/Proxy \
  -H "Content-Type: application/json" \
  -d '{"name":"节点名称"}'

# 测试节点延迟
curl "http://127.0.0.1:9090/proxies/节点名称/delay?timeout=5000&url=http://www.gstatic.com/generate_204"

# 测试所有节点延迟
curl "http://127.0.0.1:9090/group/Proxy/delay?timeout=5000&url=http://www.gstatic.com/generate_204"
```

## 5. 更新订阅

```bash
# 下载新配置
curl -o /opt/clash/config.yaml "你的订阅链接"

# 重启 Clash 使配置生效
sudo systemctl restart clash
```

## 6. Docker 代理配置

```bash
# 创建 Docker 代理配置目录
sudo mkdir -p /etc/systemd/system/docker.service.d

# 写入代理配置
sudo tee /etc/systemd/system/docker.service.d/proxy.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:7890"
Environment="HTTPS_PROXY=http://127.0.0.1:7890"
Environment="NO_PROXY=localhost,127.0.0.1,registry.cn-hangzhou.aliyuncs.com"
EOF

# 重启 Docker
sudo systemctl daemon-reload
sudo systemctl restart docker

# 验证 Docker 代理
sudo docker pull hello-world
```

## 7. 常用别名（可选）

```bash
# 添加到 ~/.bashrc
cat >> ~/.bashrc << 'EOF'
# Clash 快捷命令
alias clash-status='sudo systemctl status clash'
alias clash-restart='sudo systemctl restart clash'
alias clash-log='sudo journalctl -u clash -f'
alias clash-test='curl -I https://www.google.com'
alias clash-proxies='curl http://127.0.0.1:9090/proxies'
alias proxy-on='export http_proxy=http://127.0.0.1:7890 https_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890'
alias proxy-off='unset http_proxy https_proxy all_proxy'
EOF

source ~/.bashrc
```

使用别名：
```bash
clash-status    # 查看状态
clash-restart   # 重启
clash-test      # 测试连接
proxy-on        # 开启代理
proxy-off       # 关闭代理
```

## 8. 故障排查

```bash
# 检查 Clash 是否运行
sudo systemctl is-active clash

# 检查端口是否监听
sudo netstat -tlnp | grep -E "7890|7891|9090"

# 检查防火墙
sudo ufw status

# 开放端口（如果需要）
sudo ufw allow 7890
sudo ufw allow 7891
sudo ufw allow 9090

# 查看 Clash 进程
ps aux | grep clash

# 强制停止
sudo killall clash
```
