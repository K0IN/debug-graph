#include <iostream>

int fibonacci(int n)
{
  if (n <= 1)
    return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

int test()
{
  return fibonacci(10);
}

int main()
{
  test();
  std::cout << "Hello, World!" << std::endl;
  return 0;
}
