#include <print>
#include <wsdispatcher/service_handler.hpp>
#include <wsdispatcher/dispatcher.hpp>
	
// TODO: Move all boost dependencies into WsDispatcher Lib
#include <boost/asio/io_context.hpp>
#include <boost/asio/thread_pool.hpp>
#include <boost/beast/http/parser.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http/read.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <memory>

#include "lighthouse.hpp"

namespace net = boost::asio;                // from <boost/asio.hpp>
using tcp = boost::asio::ip::tcp;           // from <boost/asio/ip/tcp.hpp>

net::io_context ioc;
net::thread_pool tp(5);
tcp::endpoint ep(tcp::v4(), 880);

int main()
{
	std::println("Hello World!");
	helloLighthouse();

	// TODO: WS library is not covered by namespace. Need to fix
    auto dispatcher = std::make_shared<Dispatcher<ExampleServiceHandler>>(tp, ioc, ep);
    std::cout << "Listening on port " << ep.port() << std::endl;
    dispatcher->do_accept();
}
