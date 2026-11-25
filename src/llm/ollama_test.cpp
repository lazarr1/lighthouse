// #include "httplib.h"
// #include <nlohmann/json.hpp>
//
// int main() {
//
//
// }
#include <curl/curl.h>
#include <iostream>
#include <nlohmann/json.hpp>
#include <string>

using json = nlohmann::json;

// Callback function to capture the HTTP response body
size_t WriteCallback(void *contents, size_t size, size_t nmemb,
                     std::string *userp) {
  userp->append((char *)contents, size * nmemb);
  return size * nmemb;
}

int main() {
  CURL *curl = curl_easy_init();
  if (!curl) {
    std::cerr << "Failed to initialize CURL" << std::endl;
    return 1;
  }

  // 1. Build the JSON payload
  json payload = {
      {"model", "llama3.2"},
      {"prompt", "Explain pointers in C++ in two sentences."},
      {"stream",
       false} // Set to false to get the full response in one JSON object
  };
  std::string payloadStr = payload.dump();

  // 2. Configure the HTTP POST request
  std::string responseBuffer;
  struct curl_slist *headers = nullptr;
  headers = curl_slist_append(headers, "Content-Type: application/json");

  curl_easy_setopt(curl, CURLOPT_URL, "http://localhost:11434/api/generate");
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payloadStr.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBuffer);

  // 3. Execute the request
  CURLcode res = curl_easy_perform(curl);
  if (res != CURLE_OK) {
    std::cerr << "CURL error: " << curl_easy_strerror(res) << std::endl;
  } else {
    // 4. Parse the JSON response
    try {
      json responseJson = json::parse(responseBuffer);
      if (responseJson.contains("response")) {
        std::cout << "Model Output:\n"
                  << responseJson["response"].get<std::string>() << std::endl;
      } else {
        std::cout << "Unexpected response: " << responseBuffer << std::endl;
      }
    } catch (const json::parse_error &e) {
      std::cerr << "JSON parse error: " << e.what() << std::endl;
    }
  }

  // 5. Cleanup
  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);
  return 0;
}
