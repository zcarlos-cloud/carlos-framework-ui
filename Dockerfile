# ============================================
# Carlos UI (Vue3) Dockerfile
# 多阶段构建
# ============================================

# ---- 构建阶段 ----
FROM node:24-alpine AS builder

WORKDIR /build

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建生产环境
RUN pnpm build

# ---- 运行阶段 ----
# 基于预构建 nginx 基础镜像（已含字体、时区、常用工具）
FROM 192.168.3.30:8633/carlos/carlos-base-nginx:latest

LABEL maintainer="carlos"
LABEL version="1.3.11"

# 复制 Nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /build/dist /usr/share/nginx/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
