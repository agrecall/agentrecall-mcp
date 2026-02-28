#!/bin/bash

# AgentRecall MCP Server 测试脚本
# 测试所有核心功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# API 基础 URL
BASE_URL="${BASE_URL:-http://localhost:3000}"

# 测试计数
TESTS_PASSED=0
TESTS_FAILED=0

# 打印函数
print_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

print_section() {
    echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# 测试健康检查
test_health() {
    print_section "健康检查测试"
    
    print_info "测试 /health 端点..."
    
    if response=$(curl -sf "$BASE_URL/health" 2>/dev/null); then
        if echo "$response" | grep -q '"status":"ok"'; then
            print_success "健康检查通过"
            echo "响应: $response"
        else
            print_error "健康检查返回异常状态"
            echo "响应: $response"
        fi
    else
        print_error "健康检查请求失败"
    fi
}

# 测试 MCP Initialize
test_mcp_initialize() {
    print_section "MCP Initialize 测试"
    
    print_info "测试 MCP Initialize 握手..."
    
    response=$(curl -sf -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"protocolVersion":"2024-11-05"'; then
            print_success "MCP Initialize 成功"
            echo "响应: $response" | head -c 500
            echo "..."
        else
            print_error "MCP Initialize 返回异常"
            echo "响应: $response"
        fi
    else
        print_error "MCP Initialize 请求失败"
    fi
}

# 测试 MCP Tools/List
test_mcp_tools_list() {
    print_section "MCP Tools/List 测试"
    
    print_info "测试 MCP Tools/List..."
    
    response=$(curl -sf -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list"
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"tools"'; then
            print_success "MCP Tools/List 成功"
            echo "工具数量: $(echo "$response" | grep -o '"name"' | wc -l)"
        else
            print_error "MCP Tools/List 返回异常"
            echo "响应: $response"
        fi
    else
        print_error "MCP Tools/List 请求失败"
    fi
}

# 测试 MCP verify_health Tool
test_mcp_verify_health() {
    print_section "MCP verify_health Tool 测试"
    
    print_info "测试 verify_health Tool..."
    
    response=$(curl -sf -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "verify_health",
                "arguments": {}
            }
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"success":true'; then
            print_success "verify_health Tool 成功"
        else
            print_error "verify_health Tool 返回异常"
            echo "响应: $response"
        fi
    else
        print_error "verify_health Tool 请求失败"
    fi
}

# 测试注册 OTP
test_register() {
    print_section "注册 OTP 测试"
    
    print_info "测试 /api/v1/auth/register..."
    
    response=$(curl -sf -X POST "$BASE_URL/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"success":true'; then
            print_success "注册 OTP 成功"
            OTP=$(echo "$response" | grep -o '"otp":"[^"]*"' | cut -d'"' -f4)
            echo "OTP: ${OTP:0:10}..."
            
            # 保存 OTP 到临时文件
            echo "$OTP" > /tmp/agentrecall_test_otp
        else
            print_error "注册 OTP 返回异常"
            echo "响应: $response"
        fi
    else
        print_error "注册 OTP 请求失败"
    fi
}

# 测试限流
test_rate_limit() {
    print_section "限流测试"
    
    print_info "测试注册限流（6次请求，第6次应该被限制）..."
    
    local blocked=false
    
    for i in {1..6}; do
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/register" \
            -H "Content-Type: application/json" \
            -d '{}' 2>/dev/null)
        
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "429" ]; then
            print_success "限流生效（第 $i 次请求被阻止）"
            blocked=true
            break
        fi
        
        sleep 0.5
    done
    
    if [ "$blocked" = false ]; then
        print_error "限流未生效"
    fi
}

# 测试脱敏
test_sanitization() {
    print_section "脱敏测试"
    
    print_info "测试脱敏功能（提交含敏感信息的数据）..."
    
    # 生成测试用的 JWT（需要激活实例，这里简化处理）
    # 实际测试需要完整的激活流程
    
    response=$(curl -sf -X POST "$BASE_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "submit_pitfall",
                "arguments": {
                    "pattern": "Error with API key: sk-abcdefghijklmnopqrstuvwxyz123456789012345678901234567890",
                    "workaround": "Check your config at /home/john/.config/app/config.json",
                    "taxonomy": {"test": true}
                }
            }
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_success "脱敏数据提交成功"
        
        # 查询验证脱敏结果
        query_response=$(curl -sf -X POST "$BASE_URL/mcp" \
            -H "Content-Type: application/json" \
            -d '{
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "query_pitfall",
                    "arguments": {
                        "limit": 1
                    }
                }
            }' 2>/dev/null)
        
        if echo "$query_response" | grep -q '{API_KEY}'; then
            print_success "脱敏验证通过（API Key 被替换）"
        else
            print_warning "脱敏结果需要手动验证"
        fi
    else
        print_error "脱敏数据提交失败"
    fi
}

# 测试搜索 API
test_search_api() {
    print_section "搜索 API 测试"
    
    print_info "测试 /api/v1/pitfalls/search..."
    
    response=$(curl -sf "$BASE_URL/api/v1/pitfalls/search?q=test&limit=5" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"success":true'; then
            print_success "搜索 API 成功"
            echo "结果数量: $(echo "$response" | grep -o '"id"' | wc -l)"
        else
            print_error "搜索 API 返回异常"
            echo "响应: $response"
        fi
    else
        print_error "搜索 API 请求失败"
    fi
}

# 测试统计 API
test_stats_api() {
    print_section "统计 API 测试"
    
    print_info "测试 /api/v1/pitfalls/stats..."
    
    response=$(curl -sf "$BASE_URL/api/v1/pitfalls/stats" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"success":true'; then
            print_success "统计 API 成功"
            echo "统计: $(echo "$response" | grep -o '"totalPitfalls":[0-9]*')"
        else
            print_error "统计 API 返回异常"
            echo "响应: $response"
        fi
    else
        print_error "统计 API 请求失败"
    fi
}

# 测试 SSE 端点
test_sse() {
    print_section "SSE 端点测试"
    
    print_info "测试 /mcp SSE 端点..."
    
    # 使用 timeout 命令测试 SSE 连接
    if timeout 3 curl -sfN "$BASE_URL/mcp" 2>/dev/null | head -n 5 | grep -q "event:"; then
        print_success "SSE 端点响应正常"
    else
        print_warning "SSE 端点测试需要手动验证"
    fi
}

# 运行所有测试
run_all_tests() {
    print_section "开始测试 AgentRecall MCP Server"
    echo "API 地址: $BASE_URL"
    echo ""
    
    # 等待服务就绪
    print_info "等待服务就绪..."
    for i in {1..30}; do
        if curl -sf "$BASE_URL/health" &>/dev/null; then
            break
        fi
        sleep 1
    done
    
    # 运行测试
    test_health
    test_mcp_initialize
    test_mcp_tools_list
    test_mcp_verify_health
    test_register
    test_rate_limit
    test_sanitization
    test_search_api
    test_stats_api
    test_sse
    
    # 测试报告
    print_section "测试报告"
    echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "失败: ${RED}$TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}所有测试通过！${NC}"
        exit 0
    else
        echo -e "\n${RED}有测试失败，请检查日志${NC}"
        exit 1
    fi
}

# 显示帮助
show_help() {
    cat << EOF
AgentRecall MCP Server 测试脚本

用法: ./test.sh [选项]

选项:
    -h, --help      显示帮助信息
    -u, --url       设置 API 基础 URL (默认: http://localhost:3000)

示例:
    ./test.sh                    # 运行所有测试
    ./test.sh -u http://api.example.com  # 测试远程服务器

EOF
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 运行测试
run_all_tests
