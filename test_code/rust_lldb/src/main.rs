fn main() {
    let greeting = "Hello, world!";
    println!("{}", greeting);

    let number = 42;
    println!("The number is: {}", number);

    let result = add(5, 3);
    println!("The sum is: {}", result);
}

fn add(a: i32, b: i32) -> i32 {
    a + b
}
