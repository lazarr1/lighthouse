#pragma once

#include <optional>

enum class SupportLevel {
    Unsupported,
    Native,
    Emulated
};

struct SchemaCapabilities {
    SupportLevel addColumn;
    SupportLevel renameColumn;
    SupportLevel dropColumn;
    SupportLevel changeColumnType;

    bool transactionalChanges;
};

struct ConcurrencyCapabilities {
    bool concurrentReads;
    bool readsDuringWrite;

    // nullopt means the adapter imposes no fixed writer-count limit.
    std::optional<std::size_t> maxConcurrentWriters;
};

struct Capabilities {
    bool writable;
    bool transactions;
    bool readOnlyTransactions;

    SchemaCapabilities schema;
    ConcurrencyCapabilities concurrency;
};
