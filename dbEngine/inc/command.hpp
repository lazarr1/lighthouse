#pragma once

#include <string>
#include <vector>

class Command {
public:
    virtual ~Command() = default;
};

struct SqlCommand : Command {
    std::string statement;
    std::vector<Value> parameters;
};

struct DocumentQuery : Command {
    std::string collection;
    Document filter;
    Document projection;
};
