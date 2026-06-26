package main

import "fmt"

func add(a, b int) int {
	return a + b
}

func subtract(a, b int) int {
	return a - b
}

func nestedCalc(n int) int {
	if n <= 0 {
		return 0
	}
	if n == 1 {
		return 42
	}
	// Recurse twice for a deeper call tree
	left := nestedCalc(n - 1)
	right := nestedCalc(n - 2)
	return add(left, subtract(right, n))
}

func main() {
	// A very long main function — just adding/subtracting numbers
	// to create a function that spans many lines for debugging.
	x := 0

	x = add(x, 10)
	x = subtract(x, 3)
	x = add(x, 7)
	x = subtract(x, 2)
	x = add(x, 15)
	x = subtract(x, 5)
	x = add(x, 3)
	x = subtract(x, 1)
	x = add(x, 20)
	x = subtract(x, 8)
	x = add(x, 6)
	x = subtract(x, 4)
	x = add(x, 12)
	x = subtract(x, 7)
	x = add(x, 9)
	x = subtract(x, 3)
	x = add(x, 11)
	x = subtract(x, 5)
	x = add(x, 4)
	x = subtract(x, 2)
	x = add(x, 18)
	x = subtract(x, 6)
	x = add(x, 8)
	x = subtract(x, 4)
	x = add(x, 14)
	x = subtract(x, 9)
	x = add(x, 5)
	x = subtract(x, 1)
	x = add(x, 22)
	x = subtract(x, 10)
	x = add(x, 7)
	x = subtract(x, 3)
	x = add(x, 16)
	x = subtract(x, 8)
	x = add(x, 2)
	x = subtract(x, 1)
	x = add(x, 13)
	x = subtract(x, 6)
	x = add(x, 10)
	x = subtract(x, 5)
	x = add(x, 19)
	x = subtract(x, 7)
	x = add(x, 4)
	x = subtract(x, 2)
	x = add(x, 25)
	x = subtract(x, 11)
	x = add(x, 3)
	x = subtract(x, 1)
	x = add(x, 17)
	x = subtract(x, 9)
	x = add(x, 6)
	x = subtract(x, 3)
	x = add(x, 21)
	x = subtract(x, 8)
	x = add(x, 5)
	x = subtract(x, 2)
	x = add(x, 14)
	x = subtract(x, 7)
	x = add(x, 9)
	x = subtract(x, 4)
	x = add(x, 23)
	x = subtract(x, 12)
	x = add(x, 8)
	x = subtract(x, 3)
	x = add(x, 11)
	x = subtract(x, 6)
	x = add(x, 1)
	x = subtract(x, 1)
	x = add(x, 30)
	x = subtract(x, 14)
	x = add(x, 10)
	x = subtract(x, 4)
	x = add(x, 24)
	x = subtract(x, 10)
	x = add(x, 7)
	x = subtract(x, 3)
	x = add(x, 15)
	x = subtract(x, 8)
	x = add(x, 2)
	x = subtract(x, 1)
	x = add(x, 28)
	x = subtract(x, 13)
	x = add(x, 6)
	x = subtract(x, 2)
	x = add(x, 20)
	x = subtract(x, 9)

	// Now call the recursive nested function — produces call stacks
	result := nestedCalc(5)

	fmt.Println("final x:", x)
	fmt.Println("nested result:", result)
}
