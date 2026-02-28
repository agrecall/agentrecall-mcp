#!/bin/bash

# AgentRecall MCP Server 部署脚本
# 支持：安装、启动、停止、重启、状态检查、日志查看

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 和 Docker Compose
check_docker() {
    print_info "检查 Docker 环境..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    # 检查 Docker 服务是否运行
    if ! docker info &> /dev/null; then
        print_error "Docker 服务未运行，请启动 Docker 服务"
        exit 1
    fi
    
    print_success "Docker 环境检查通过"
}

# 检查环境变量
check_env() {
    print_info "检查环境变量..."
    
    if [ ! -f .env ]; then
        print_warning ".env 文件不存在，从 .env.example 创建"
        cp .env.example .env
        print_error "请编辑 .env 文件，设置必需的配置项后重新运行"
        exit 1
    fi
    
    # 加载环境变量
    set -a
    source .env
    set +a
    
    # 检查必需的环境变量
    local required_vars=("DB_PASSWORD" "JWT_SECRET" "OTP_MASTER_KEY")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "以下环境变量未设置: ${missing_vars[*]}"
        print_error "请编辑 .env 文件后重新运行"
        exit 1
    fi
    
    # 检查密钥长度
    if [ ${#JWT_SECRET} -lt 32 ]; then
        print_error "JWT_SECRET 必须至少 32 个字符"
        exit 1
    fi
    
    if [ ${#OTP_MASTER_KEY} -lt 32 ]; then
        print_error "OTP_MASTER_KEY 必须至少 32 个字符"
        exit 1
    fi
    
    print_success "环境变量检查通过"
}

# 创建必要的目录
create_directories() {
    print_info "创建必要的目录..."
    
    mkdir -p server/logs
    mkdir -p nginx/ssl
    mkdir -p web/dist
    
    print_success "目录创建完成"
}

# 安装/更新服务
install() {
    print_info "开始安装 AgentRecall MCP Server..."
    
    check_docker
    check_env
    create_directories
    
    print_info "拉取最新镜像..."
    docker-compose pull
    
    print_info "构建服务..."
    docker-compose build --no-cache
    
    print_success "安装完成！"
    print_info "运行 './deploy.sh start' 启动服务"
}

# 启动服务
start() {
    print_info "启动 AgentRecall MCP Server..."
    
    check_env
    
    print_info "启动服务..."
    docker-compose up -d
    
    print_info "等待服务启动..."
    sleep 5
    
    # 检查服务状态
    if check_health; then
        print_success "服务启动成功！"
        print_info "API 地址: http://localhost:3000"
        print_info "健康检查: http://localhost:3000/health"
    else
        print_error "服务启动失败，请检查日志"
        print_info "运行 './deploy.sh logs' 查看日志"
        exit 1
    fi
}

# 停止服务
stop() {
    print_info "停止 AgentRecall MCP Server..."
    docker-compose down
    print_success "服务已停止"
}

# 重启服务
restart() {
    print_info "重启 AgentRecall MCP Server..."
    stop
    start
}

# 查看状态
status() {
    print_info "服务状态:"
    docker-compose ps
    
    print_info "\n资源使用:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null || true
}

# 健康检查
check_health() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf http://localhost:3000/health &> /dev/null; then
            return 0
        fi
        
        print_info "等待服务就绪... ($attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    return 1
}

# 查看日志
logs() {
    local service=${1:-""}
    
    if [ -z "$service" ]; then
        docker-compose logs -f --tail=100
    else
        docker-compose logs -f --tail=100 "$service"
    fi
}

# 更新服务
update() {
    print_info "更新 AgentRecall MCP Server..."
    
    print_info "拉取最新代码..."
    git pull || print_warning "无法拉取代码，跳过"
    
    print_info "重新构建服务..."
    docker-compose build --no-cache
    
    print_info "重启服务..."
    restart
    
    print_success "更新完成！"
}

# 备份数据
backup() {
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_info "备份数据到 $backup_dir..."
    
    # 备份 PostgreSQL
    docker-compose exec -T postgres pg_dump -U agentrecall agentrecall > "$backup_dir/database.sql"
    
    # 备份环境变量
    cp .env "$backup_dir/"
    
    print_success "备份完成: $backup_dir"
}

# 恢复数据
restore() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        print_error "请指定备份文件路径"
        print_info "用法: ./deploy.sh restore <备份文件>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "备份文件不存在: $backup_file"
        exit 1
    fi
    
    print_warning "恢复数据将覆盖现有数据，是否继续? (y/N)"
    read -r confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_info "取消恢复"
        exit 0
    fi
    
    print_info "恢复数据..."
    docker-compose exec -T postgres psql -U agentrecall agentrecall < "$backup_file"
    
    print_success "恢复完成"
}

# 清理数据
clean() {
    print_warning "这将删除所有数据，包括数据库和日志！"
    print_warning "是否继续? (yes/no)"
    read -r confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "取消清理"
        exit 0
    fi
    
    print_info "停止服务..."
    docker-compose down -v
    
    print_info "清理日志..."
    rm -rf server/logs/*
    
    print_info "清理构建缓存..."
    docker system prune -f
    
    print_success "清理完成"
}

# 显示帮助信息
show_help() {
    cat << EOF
AgentRecall MCP Server 部署脚本

用法: ./deploy.sh [命令] [选项]

命令:
    install     安装/初始化服务
    start       启动服务
    stop        停止服务
    restart     重启服务
    status      查看服务状态
    logs        查看日志 [服务名]
    update      更新服务
    backup      备份数据
    restore     恢复数据 <备份文件>
    clean       清理所有数据（危险！）
    health      健康检查
    help        显示帮助信息

示例:
    ./deploy.sh install          # 安装服务
    ./deploy.sh start            # 启动服务
    ./deploy.sh logs mcp-server  # 查看 MCP Server 日志
    ./deploy.sh backup           # 备份数据

EOF
}

# 主函数
main() {
    case "${1:-help}" in
        install)
            install
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            status
            ;;
        logs)
            logs "$2"
            ;;
        update)
            update
            ;;
        backup)
            backup
            ;;
        restore)
            restore "$2"
            ;;
        clean)
            clean
            ;;
        health)
            if check_health; then
                print_success "服务健康"
            else
                print_error "服务不健康"
                exit 1
            fi
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
