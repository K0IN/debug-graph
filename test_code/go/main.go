package main

import "fmt"

func main() {
	// Example code
	x := 5
	y := 10

	// Print debug information
	fmt.Println("Debug information:")
	fmt.Println("x =", x)
	fmt.Println("y =", y)

	// Call other functions
	sum := add(x, y)
	product := multiply(x, y)

	// Print the results
	fmt.Println("Sum =", sum)
	fmt.Println("Product =", product)
}

func add(a, b int) int {
	return a + b
}

func multiply(a, b int) int {
	return a * b
}
