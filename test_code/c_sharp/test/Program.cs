// See https://aka.ms/new-console-template for more information
using ClassLibrary1;
using mytest;
Console.WriteLine("Hello, World!");


async Task main()
{
  var test = new MyTest();
  await test.main();
}

await main();