namespace test
{
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
  }
}