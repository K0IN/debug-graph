"""a test module"""


class Dummy:
    """dummy class"""

    def __init__(self):
        self.a = 1
        self.b = 2

    def dummy_method(self):
        """dummy method"""
        print("This is a dummy method", self.a, self.b)


def deep_code():
    """i do stuff"""
    a = {"a": 1, "b": 2, "c": 3}
    x = Dummy()
    x.dummy_method()
    b = 2
    c = 1 + b
    d = c ** c
    print("This is a deep code", c, d)

    def lol():
        print("This is a lol function")
    lol()


def main():
    """main code"""
    print("This is a main code")
    a = 1
    b = 2
    c = a + b
    deep_code()
    deep_code()
    deep_code()


if __name__ == "__main__":
    a = 1337
    main()
