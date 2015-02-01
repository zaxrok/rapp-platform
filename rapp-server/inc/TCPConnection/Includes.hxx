#include <iostream>
#include <string>
#include <deque>
#include <algorithm>
#include <fstream>

#include <boost/bind.hpp>
#include <boost/shared_ptr.hpp>
#include <boost/enable_shared_from_this.hpp>
#include <boost/asio.hpp>
#include <boost/asio/buffer.hpp>
#include <boost/asio/deadline_timer.hpp>


using boost::asio::ip::tcp;
using boost::asio::deadline_timer;
