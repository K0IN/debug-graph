class Parent {
  constructor() {
    this.name = "Parent";
  }

  callChild() {
    const child = new Child();
    child.callGrandchild();
  }
}

class Child extends Parent {
  constructor() {
    super();
    this.name = "Child";
  }

  callGrandchild() {
    const grandchild = new Grandchild();
    grandchild.printStackTrace();
  }
}

class Grandchild extends Child {
  constructor() {
    super();
    this.name = "Grandchild";
  }

  printStackTrace() {
    console.trace(`Stack trace for ${this.name}`);
  }
}

const obj = new Parent();
obj.callChild();

function showAllStackTraces() {
  const grandchild = new Grandchild();
  grandchild.printStackTrace();
}

showAllStackTraces();