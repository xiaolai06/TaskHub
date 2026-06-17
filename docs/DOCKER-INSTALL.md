# Docker 安装指南

> 适用于 Ubuntu 22.04 服务器

## 一键安装（推荐）

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER

# 重新登录使权限生效
newgrp docker

# 验证安装
docker --version
docker compose version
```

## 启动 Docker

```bash
# 启动 Docker 服务
sudo systemctl start docker

# 设置开机自启
sudo systemctl enable docker

# 查看状态
sudo systemctl status docker
```

## 测试安装

```bash
# 运行测试容器
docker run hello-world
```

如果看到 "Hello from Docker!" 说明安装成功。

## 国内镜像加速（可选）

编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://hub-mirror.c.163.com"
  ]
}
```

重启 Docker：

```bash
sudo systemctl restart docker
```
