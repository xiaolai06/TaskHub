#!/bin/bash
# Clash 一键安装脚本（Linux 服务器版）

set -e

# 配置（替换成你的订阅链接）
SUB_URL="你的Clash订阅链接"

echo "=== 1. 下载 Clash ==="
mkdir -p /opt/clash
cd /opt/clash

# 下载 Clash Premium（Linux amd64）
wget -q https://github.com/Dreamacro/clash/releases/download/v1.18.0/clash-linux-amd64-v1.18.0.gz -O clash.gz
gunzip clash.gz
chmod +x clash

echo "=== 2. 下载配置文件 ==="
wget -q "$SUB_URL" -O config.yaml

echo "=== 3. 创建 systemd 服务 ==="
cat > /etc/systemd/system/clash.service << 'EOF'
[Unit]
Description=Clash Proxy Service
After=network.target

[Service]
Type=simple
ExecStart=/opt/clash/clash -d /opt/clash
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "=== 4. 启动服务 ==="
systemctl daemon-reload
systemctl enable clash
systemctl start clash

echo "=== 5. 配置环境变量 ==="
cat >> /etc/profile.d/proxy.sh << 'EOF'
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
export all_proxy=socks5://127.0.0.1:7890
EOF

echo "=== 6. 测试连接 ==="
sleep 2
curl -s --max-time 10 https://www.google.com > /dev/null && echo "✓ 代理连接成功" || echo "✗ 连接失败，请检查订阅链接"

echo ""
echo "=== 安装完成 ==="
echo "端口: 7890 (HTTP) / 7891 (SOCKS5)"
echo "Web 面板: http://你的服务器IP:9090/ui"
echo ""
echo "使环境变量生效: source /etc/profile.d/proxy.sh"
