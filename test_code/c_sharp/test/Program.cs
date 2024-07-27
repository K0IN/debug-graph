// See https://aka.ms/new-console-template for more information
using test;

Console.WriteLine("Hello, World!");


void main()
{
  ITest test = new TestClass();
  test.Test();
  Console.WriteLine("Hello, World!");
}

main();