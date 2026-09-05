#pragma once

class iDatabaseSession;
class config;
class capabilities; 


class iDatabaseAdapter {
  iDatabaseSession open(config conf);
  capabilities getCapabilities();
};
