namespace ClassLibrary1;

public interface ITest
{
  void Test();
}

public class TestClass : ITest
{
  public void Test()
  {
    System.Console.WriteLine("Test");
  }
  public async Task TestAsync()
  {
    await Task.Delay(1000); // Simulate some asynchronous operation
    System.Console.WriteLine("Async Test");
    await Task.Delay(1000); // Simulate some asynchronous operation
    Test2();
  }

  public void Test2()
  {
    System.Console.WriteLine("Test2");
  }
}
