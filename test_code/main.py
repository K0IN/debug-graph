def deep_code():
    a = 1
    b = 2
    c = a + b
    d = c ** c
    print("This is a deep code", c, d)

    def lol():
        print("This is a lol function")
    lol()


def main():
    print("This is a main code")
    deep_code()
    deep_code()
    deep_code()


if __name__ == "__main__":
    main()
