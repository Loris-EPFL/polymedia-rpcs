#!/bin/bash

# Launch with ./test_rpc.sh
# or ./test_rpc.sh queryTransactionBlocks


# Define RPC endpoints to test
RPC_ENDPOINTS=(
#   "https://sui.obsuidian.xyz:2020"
#   "https://sui.obsuidian.xyz:443"
#   "https://sui.obsuidian.xyz"
#   "http://sui.obsuidian.xyz"
#   "http://sui.obsuidian.xyz:443"
#   "http://sui.obsuidian.xyz:80"
  "http://45.10.161.136:2220"
  https://sui-mainnet.nodeinfra.com
#   "http://localhost:2220"
#   "https://sui.obsuidian.xyz:443/json-rpc/"
)

# Function to generate a random Sui address
generate_random_address() {
  echo "0x$(openssl rand -hex 32)"
}

# Function to measure RPC latency for multiGetObjects
test_multi_get_objects() {
  local endpoint=$1
  local num_objects=20
  local ids="["
  
  # Generate random object IDs
  for ((i=0; i<num_objects; i++)); do
    if [ $i -gt 0 ]; then
      ids="$ids,"
    fi
    ids="$ids\"$(generate_random_address)\""
  done
  ids="$ids]"
  
  # Create the JSON-RPC request
  local request='{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sui_multiGetObjects",
    "params": [
      '"$ids"',
      {
        "showContent": true,
        "showType": true,
        "showDisplay": true
      }
    ]
  }'
  
  # Measure the latency
  local start_time=$(date +%s.%N)
  local response=$(curl -s -X POST -H "Content-Type: application/json" -d "$request" "$endpoint" 2>/dev/null)
  local end_time=$(date +%s.%N)
  
  # Calculate latency in milliseconds
  local latency=$(echo "($end_time - $start_time) * 1000" | bc)
  
  # Check if the response is valid JSON
  if echo "$response" | jq . >/dev/null 2>&1; then
    echo "$latency"
  else
    echo "error"
  fi
}

# Function to measure RPC latency for queryTransactionBlocks
test_query_transaction_blocks() {
  local endpoint=$1
  local bidder_package_id="0x7bfe75f51565a2e03e169c85a50c490ee707692a14d5417e2b97740da0d48627"
  
  # Create the JSON-RPC request
  local request='{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sui_queryTransactionBlocks",
    "params": [
      {
        "filter": {
          "MoveFunction": {
            "package": "'"$bidder_package_id"'",
            "module": "auction",
            "function": "admin_creates_auction"
          }
        }
      },
      {
        "showEffects": true,
        "showObjectChanges": true,
        "showInput": true
      }
    ]
  }'
  
  # Measure the latency
  local start_time=$(date +%s.%N)
  local response=$(curl -s -X POST -H "Content-Type: application/json" -d "$request" "$endpoint" 2>/dev/null)
  local end_time=$(date +%s.%N)
  
  # Calculate latency in milliseconds
  local latency=$(echo "($end_time - $start_time) * 1000" | bc)
  
  # Check if the response is valid JSON
  if echo "$response" | jq . >/dev/null 2>&1; then
    echo "$latency"
  else
    echo "error"
  fi
}

# Function to calculate average
calculate_average() {
  local sum=0
  local count=0
  
  for value in "$@"; do
    if [[ "$value" != "error" ]]; then
      sum=$(echo "$sum + $value" | bc)
      ((count++))
    fi
  done
  
  if [ $count -eq 0 ]; then
    echo "N/A"
  else
    echo "scale=2; $sum / $count" | bc
  fi
}

# Function to calculate percentile
calculate_percentile() {
  local percentile=$1
  shift
  
  # Filter out errors and sort the values
  local sorted_values=()
  for value in "$@"; do
    if [[ "$value" != "error" ]]; then
      sorted_values+=("$value")
    fi
  done
  
  if [ ${#sorted_values[@]} -eq 0 ]; then
    echo "N/A"
    return
  fi
  
  # Sort the values
  IFS=$'\n' sorted_values=($(sort -n <<<"${sorted_values[*]}"))
  unset IFS
  
  # Calculate the rank
  local n=${#sorted_values[@]}
  local rank=$(echo "($percentile * ($n - 1))" | bc -l)
  local lower_index=$(echo "scale=0; $rank / 1" | bc)
  local upper_index=$(echo "scale=0; ($rank + 0.999) / 1" | bc)
  
  # If rank is an integer, return the value at that rank
  if (( $(echo "$rank == $lower_index" | bc -l) )); then
    echo "${sorted_values[$lower_index]}"
  else
    # Interpolate between the closest ranks
    local lower_value=${sorted_values[$lower_index]}
    local upper_value=${sorted_values[$upper_index]}
    local weight=$(echo "$rank - $lower_index" | bc -l)
    echo "scale=2; $lower_value + ($upper_value - $lower_value) * $weight" | bc
  fi
}

# Main function to run the tests
run_tests() {
  local test_type=$1
  local num_rounds=11  # First round is discarded
  
  echo "Running $test_type tests for ${#RPC_ENDPOINTS[@]} endpoints..."
  echo "Endpoint,Average,P50,P90,Status"
  
  for endpoint in "${RPC_ENDPOINTS[@]}"; do
    echo -n "Testing $endpoint... "
    
    # Run the tests
    local latencies=()
    local has_error=false
    
    for ((round=0; round<num_rounds; round++)); do
      if [ "$test_type" == "multiGetObjects" ]; then
        result=$(test_multi_get_objects "$endpoint")
      else
        result=$(test_query_transaction_blocks "$endpoint")
      fi
      
      if [ "$result" == "error" ]; then
        has_error=true
        break
      fi
      
      # Skip the first round due to DNS and TLS overhead
      if [ $round -gt 0 ]; then
        latencies+=("$result")
      fi
    done
    
    # Calculate statistics
    if [ "$has_error" == "false" ] && [ ${#latencies[@]} -gt 0 ]; then
      local average=$(calculate_average "${latencies[@]}")
      local p50=$(calculate_percentile 0.5 "${latencies[@]}")
      local p90=$(calculate_percentile 0.9 "${latencies[@]}")
      echo "$endpoint,$average,$p50,$p90,Success"
    else
      echo "$endpoint,N/A,N/A,N/A,Error"
    fi
  done
}

# Check for required tools
for cmd in curl jq bc openssl; do
  if ! command -v $cmd &> /dev/null; then
    echo "Error: $cmd is required but not installed."
    exit 1
  fi
done

# Parse command line arguments
test_type="multiGetObjects"
if [ "$1" == "queryTransactionBlocks" ]; then
  test_type="queryTransactionBlocks"
fi

# Run the tests
run_tests "$test_type"
