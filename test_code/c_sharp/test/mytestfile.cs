using ClassLibrary1;

namespace mytest;

public class MyTest
{
  public async Task main()
  {
    var test = new TestClass();
    var task1 = test.TestAsync();
    var task2 = test.TestAsync();
    await Task.WhenAll(task1, task2);
    test.Test2();

  }

}